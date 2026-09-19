"""Cheap screen: ElevenLabs AI voice + openWakeWord → alarm / sensitivity."""

from __future__ import annotations

from dataclasses import dataclass, field

from settings import settings


SensitivityTier = str  # not_sensitive | low | medium | high


@dataclass
class ScreenResult:
    elevenlabs_ai_score: float | None = None
    ai_voice_used: str | None = None
    ai_generated: bool | None = None
    keyword_hits: list[dict] = field(default_factory=list)
    alarm_score: float = 0.0
    sensitivity: str = "not_sensitive"
    escalate: bool = False
    clipped_seconds: float | None = None
    warnings: list[str] = field(default_factory=list)


def compute_alarm(
    *,
    ai_score: float | None,
    keyword_hit_count: int,
    ai_escalate_at: float | None = None,
    min_keyword_hits: int | None = None,
) -> tuple[float, str, bool]:
    """
    Dumb v1 heuristic (replaceable later with a statistical model):
      escalate if ai_score >= AI_ESCALATE_THRESHOLD (default 0.5)
      OR keyword_hits >= MIN_KEYWORD_HITS_TO_ESCALATE (default 1)
    """
    ai_at = settings.ai_escalate_threshold if ai_escalate_at is None else ai_escalate_at
    kw_at = settings.min_keyword_hits_to_escalate if min_keyword_hits is None else min_keyword_hits

    ai = float(ai_score) if ai_score is not None else 0.0
    has_kw = keyword_hit_count >= kw_at
    ai_hot = ai_score is not None and ai >= ai_at
    escalate = ai_hot or has_kw

    alarm = max(ai, 1.0 if has_kw else 0.0)
    if not escalate:
        sensitivity = "not_sensitive"
    elif ai_hot and has_kw:
        sensitivity = "high"
    elif ai_hot or keyword_hit_count >= 2:
        sensitivity = "medium"
    else:
        sensitivity = "low"

    return alarm, sensitivity, escalate


def map_ai_generated(ai_voice_used: str | None) -> bool | None:
    if ai_voice_used == "yes":
        return True
    if ai_voice_used == "no":
        return False
    return None


def run_screen(file_bytes: bytes, filename: str, content_type: str) -> ScreenResult:
    """Clip+ElevenLabs (via ai_audio) and openWakeWord; compute alarm."""
    from paths import AI_AUDIO, prefer_package

    prefer_package(
        AI_AUDIO,
        drop_modules=("models", "config", "classifier", "clip_audio"),
    )
    warnings: list[str] = []
    ai_score = None
    ai_voice_used = None
    clipped_seconds = None

    try:
        from classifier import classify_audio

        detected = classify_audio(file_bytes, filename, content_type)
        ai_score = detected.elevenlabs_ai_score
        ai_voice_used = detected.ai_voice_used
        clipped_seconds = getattr(detected, "clipped_seconds", None)
    except Exception as exc:
        warnings.append(f"ElevenLabs screen unavailable: {exc}")

    # Prefer clipped wav bytes for KWS when ElevenLabs path already clipped —
    # re-clip locally for KWS so we don't depend on classifier internals.
    from clip_audio import clip_leading_audio
    from config import settings as ai_settings

    clip = clip_leading_audio(
        file_bytes,
        filename,
        content_type,
        seconds=getattr(ai_settings, "clip_seconds", 30.0),
    )
    if clip.warning:
        warnings.append(clip.warning)

    from keywords import spot_keywords

    kw = spot_keywords(clip.data, clip.filename, clip.content_type)
    if kw.warning:
        warnings.append(kw.warning)
    hits = [{"label": h.label, "score": h.score} for h in kw.hits]

    alarm, sensitivity, escalate = compute_alarm(
        ai_score=ai_score,
        keyword_hit_count=len(hits),
    )

    return ScreenResult(
        elevenlabs_ai_score=ai_score,
        ai_voice_used=ai_voice_used,
        ai_generated=map_ai_generated(ai_voice_used),
        keyword_hits=hits,
        alarm_score=alarm,
        sensitivity=sensitivity,
        escalate=escalate,
        clipped_seconds=clipped_seconds if clipped_seconds is not None else clip.clipped_seconds,
        warnings=warnings,
    )
