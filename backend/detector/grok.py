from __future__ import annotations

from typing import Any

from schemas import GrokFlags


class GrokError(Exception):
    def __init__(self, message: str, *, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def parse_grok_payload(payload: Any) -> GrokFlags:
    if not isinstance(payload, dict):
        raise GrokError("Grok returned a non-object payload")
    try:
        confidence = float(payload["confidence"])
    except (KeyError, TypeError, ValueError) as exc:
        raise GrokError("Grok payload missing numeric confidence") from exc
    try:
        is_scam = bool(payload["is_scam"])
    except KeyError as exc:
        raise GrokError("Grok payload missing is_scam") from exc
    return GrokFlags(
        is_scam=is_scam,
        scam_type=str(payload.get("scam_type") or "none"),
        confidence=max(0.0, min(1.0, confidence)),
        reasoning=str(payload.get("reasoning") or ""),
        method=str(payload.get("method") or "none"),
        target=str(payload.get("target") or "unclear"),
    )


def run_grok_flags(transcript: str) -> GrokFlags:
    from paths import ensure_import_paths

    ensure_import_paths()
    from detect_scam import detect_scam

    try:
        payload = detect_scam(transcript)
    except Exception as exc:
        raise GrokError(f"Grok scam classifier failed: {exc}") from exc
    return parse_grok_payload(payload)
