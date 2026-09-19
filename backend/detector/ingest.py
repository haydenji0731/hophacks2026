from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from paths import DB, WARNINGS, prefer_package
from pipeline import analyze_incident
from schemas import AnalyzeResponse, DbUpsertResult, IngestResponse, NotifyResult


@dataclass
class IngestInputs:
    transcript: str | None
    to: str | None
    audio: tuple[bytes, str, str] | None = None


def _notify_result_from_payload(payload: Any) -> NotifyResult:
    data = payload.model_dump() if hasattr(payload, "model_dump") else payload
    return NotifyResult.model_validate(data)


def upsert_report(
    *,
    scam_type: str,
    method: str = "none",
    target: str = "unclear",
    reasoning: str = "",
    ai_generated: bool | None = None,
    platform: str = "phone",
) -> tuple[DbUpsertResult, list[str]]:
    """Save a user-confirmed questionnaire report into scam patterns. No SMS."""
    warnings: list[str] = []
    try:
        prefer_package(
            DB,
            drop_modules=("models", "session", "repository", "db_config"),
        )
        from models import Platform
        from repository import upsert_scam_from_detection
        from session import get_session_factory
    except Exception as exc:
        warnings.append(f"Database imports unavailable: {exc}")
        return DbUpsertResult(action="skipped"), warnings

    try:
        plat = Platform(platform)
    except ValueError:
        plat = Platform.other

    try:
        session = get_session_factory()()
        try:
            result = upsert_scam_from_detection(
                session,
                scam_type=scam_type,
                method=method,
                target=target,
                reasoning=reasoning,
                ai_generated=ai_generated,
                platform=plat,
            )
        finally:
            session.close()
    except Exception as exc:
        warnings.append(f"Database upsert failed: {exc}")
        return DbUpsertResult(action="skipped"), warnings

    if result is None:
        return DbUpsertResult(action="skipped"), warnings

    scam, action = result
    return (
        DbUpsertResult(
            action=action,
            scam_id=str(scam.id),
            name=scam.name,
            frequency=int(scam.frequency),
        ),
        warnings,
    )


def _try_upsert(analysis: AnalyzeResponse) -> tuple[DbUpsertResult | None, list[str]]:
    grok = analysis.grok
    if grok is None or not grok.is_scam:
        return DbUpsertResult(action="skipped"), []
    return upsert_report(
        scam_type=grok.scam_type,
        method=grok.method,
        target=grok.target,
        reasoning=grok.reasoning,
        ai_generated=analysis.ai_generated,
    )


def _try_notify(analysis: AnalyzeResponse, to: str | None) -> tuple[NotifyResult | None, list[str]]:
    warnings: list[str] = []
    grok = analysis.grok
    if grok is None or not grok.is_scam:
        return None, warnings
    if not to or not to.strip():
        warnings.append("Notify skipped: no destination phone number (to).")
        return None, warnings

    try:
        prefer_package(
            WARNINGS,
            drop_modules=("models", "notifier", "messages", "warn_config"),
        )
        from models import NotifyRequest
        from notifier import NotifierError, notify
    except Exception as exc:
        warnings.append(f"Notifier imports unavailable: {exc}")
        return None, warnings

    try:
        response = notify(
            NotifyRequest(
                to=to.strip(),
                notification_tier=analysis.notification_tier,
                reason=analysis.reason,
                scam_confidence=analysis.scam_confidence,
                scam_type=grok.scam_type,
            )
        )
        return _notify_result_from_payload(response), warnings
    except NotifierError as exc:
        warnings.append(f"Notify failed: {exc.message}")
        return None, warnings
    except Exception as exc:
        warnings.append(f"Notify failed: {exc}")
        return None, warnings


def ingest_incident(inputs: IngestInputs) -> IngestResponse:
    analysis = analyze_incident(transcript=inputs.transcript, audio=inputs.audio)
    extra_warnings: list[str] = []

    db_result, db_warnings = _try_upsert(analysis)
    extra_warnings.extend(db_warnings)

    notify_result, notify_warnings = _try_notify(analysis, inputs.to)
    extra_warnings.extend(notify_warnings)

    return IngestResponse(
        elevenlabs_ai_score=analysis.elevenlabs_ai_score,
        ai_voice_used=analysis.ai_voice_used,
        ai_generated=analysis.ai_generated,
        grok=analysis.grok,
        scam_confidence=analysis.scam_confidence,
        notification_tier=analysis.notification_tier,
        reason=analysis.reason,
        warnings=[*analysis.warnings, *extra_warnings],
        db=db_result,
        notify=notify_result,
    )
