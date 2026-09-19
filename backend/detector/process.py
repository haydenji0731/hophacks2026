"""Full mid-call path: screen → (if escalate) STT → Grok → log + notify."""

from __future__ import annotations

from dataclasses import dataclass

from combine import notification_tier
from grok import GrokError, run_grok_flags
from ingest import _try_notify, _try_upsert
from screen import ScreenResult, run_screen
from settings import settings
from stt import STTError, transcribe_audio_bytes
from schemas import AnalyzeResponse, DbUpsertResult, GrokFlags, NotifyResult, ProcessResponse


@dataclass
class ProcessInputs:
    audio: tuple[bytes, str, str]
    to: str | None = None
    force_escalate: bool = False


def process_audio(inputs: ProcessInputs) -> ProcessResponse:
    file_bytes, filename, content_type = inputs.audio
    warnings: list[str] = []

    screen = run_screen(file_bytes, filename, content_type)
    warnings.extend(screen.warnings)

    transcript: str | None = None
    grok: GrokFlags | None = None
    db: DbUpsertResult | None = DbUpsertResult(action="skipped")
    notify: NotifyResult | None = None
    escalated = False

    should_escalate = screen.escalate or inputs.force_escalate
    if should_escalate:
        escalated = True
        try:
            transcript = transcribe_audio_bytes(file_bytes, filename)
            if not transcript:
                warnings.append("STT returned empty transcript")
        except STTError as exc:
            warnings.append(f"STT unavailable: {exc.message}")

        if transcript:
            try:
                grok = run_grok_flags(transcript)
            except GrokError as exc:
                warnings.append(f"Grok scam detect unavailable: {exc.message}")

        if grok is not None:
            language_score = grok.confidence
            audio_score = screen.elevenlabs_ai_score
            if audio_score is None:
                combined = language_score
            else:
                w_a, w_l = settings.audio_weight, settings.language_weight
                combined = (w_a * audio_score + w_l * language_score) / (w_a + w_l)

            analysis = AnalyzeResponse(
                elevenlabs_ai_score=screen.elevenlabs_ai_score,
                ai_voice_used=screen.ai_voice_used,  # type: ignore[arg-type]
                ai_generated=screen.ai_generated,
                grok=grok,
                scam_confidence=combined,
                notification_tier=notification_tier(combined),
                reason=_reason(screen, grok),
                warnings=[],
            )
            db, db_w = _try_upsert(analysis)
            warnings.extend(db_w)
            notify, n_w = _try_notify(analysis, inputs.to)
            warnings.extend(n_w)
    else:
        warnings.append("Not escalated (screen not sensitive); skipped STT/Grok/notify")

    scam_confidence = 0.0
    notif_tier = "low"
    reason = _screen_reason(screen)
    if grok is not None:
        scam_confidence = grok.confidence
        if screen.elevenlabs_ai_score is not None:
            w_a, w_l = settings.audio_weight, settings.language_weight
            scam_confidence = (
                w_a * screen.elevenlabs_ai_score + w_l * grok.confidence
            ) / (w_a + w_l)
        notif_tier = notification_tier(scam_confidence)
        reason = _reason(screen, grok)

    return ProcessResponse(
        elevenlabs_ai_score=screen.elevenlabs_ai_score,
        ai_voice_used=screen.ai_voice_used,  # type: ignore[arg-type]
        ai_generated=screen.ai_generated,
        keyword_hits=screen.keyword_hits,
        alarm_score=screen.alarm_score,
        sensitivity=screen.sensitivity,  # type: ignore[arg-type]
        escalate=screen.escalate,
        escalated=escalated,
        clipped_seconds=screen.clipped_seconds,
        transcript=transcript,
        grok=grok,
        scam_confidence=scam_confidence,
        notification_tier=notif_tier,  # type: ignore[arg-type]
        reason=reason,
        warnings=warnings,
        db=db,
        notify=notify,
    )


def _screen_reason(screen: ScreenResult) -> str:
    parts = [
        f"alarm={screen.alarm_score:.2f}",
        f"sensitivity={screen.sensitivity}",
    ]
    if screen.elevenlabs_ai_score is not None:
        parts.append(f"elevenlabs={screen.elevenlabs_ai_score:.2f}")
    if screen.keyword_hits:
        labels = ",".join(h["label"] for h in screen.keyword_hits[:5])
        parts.append(f"keywords={labels}")
    return "; ".join(parts)


def _reason(screen: ScreenResult, grok: GrokFlags) -> str:
    base = _screen_reason(screen)
    if grok.is_scam:
        return f"{base}; scam={grok.scam_type} ({grok.confidence:.2f}): {grok.reasoning}"
    return f"{base}; not_scam ({grok.confidence:.2f}): {grok.reasoning}"
