from __future__ import annotations

from typing import Any

import httpx

from config import Settings, settings
from models import CLASSIFIER_LIMITATIONS, AiVoiceUsed, DetectResponse


class ClassifierError(Exception):
    def __init__(self, message: str, *, status_code: int = 502, upstream_status: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.upstream_status = upstream_status


def map_ai_voice_used(
    score: float,
    *,
    yes_threshold: float | None = None,
    no_threshold: float | None = None,
) -> AiVoiceUsed:
    yes_at = settings.yes_threshold if yes_threshold is None else yes_threshold
    no_at = settings.no_threshold if no_threshold is None else no_threshold
    if score >= yes_at:
        return "yes"
    if score <= no_at:
        return "no"
    return "unknown"


def build_detect_response(probability: float) -> DetectResponse:
    score = max(0.0, min(1.0, float(probability)))
    used = map_ai_voice_used(score)
    return DetectResponse(
        elevenlabs_ai_score=score,
        ai_voice_used=used,
        reason=f"ElevenLabs synthetic-voice score {score:.2f}",
        limitations=list(CLASSIFIER_LIMITATIONS),
    )


def _extract_probability(payload: Any) -> float:
    if not isinstance(payload, dict):
        raise ClassifierError("ElevenLabs classifier returned a non-object JSON body")
    if "probability" not in payload:
        raise ClassifierError("ElevenLabs classifier response missing probability")
    try:
        return float(payload["probability"])
    except (TypeError, ValueError) as exc:
        raise ClassifierError("ElevenLabs classifier probability was not a number") from exc


def classify_audio(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    *,
    client: httpx.Client | None = None,
    cfg: Settings | None = None,
) -> DetectResponse:
    cfg = cfg or settings
    headers: dict[str, str] = {}
    if cfg.elevenlabs_api_key:
        headers["xi-api-key"] = cfg.elevenlabs_api_key

    files = {"file": (filename or "audio.mp3", file_bytes, content_type or "application/octet-stream")}
    owns_client = client is None
    http = client or httpx.Client(timeout=cfg.request_timeout_seconds)
    try:
        try:
            response = http.post(cfg.elevenlabs_classifier_url, headers=headers, files=files)
        except httpx.TimeoutException as exc:
            raise ClassifierError("ElevenLabs classifier request timed out", status_code=504) from exc
        except httpx.RequestError as exc:
            raise ClassifierError(f"Could not reach ElevenLabs classifier: {exc}", status_code=502) from exc
    finally:
        if owns_client:
            http.close()

    if response.status_code >= 400:
        raise ClassifierError(
            f"ElevenLabs classifier failed with HTTP {response.status_code}",
            status_code=502,
            upstream_status=response.status_code,
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise ClassifierError("ElevenLabs classifier returned non-JSON") from exc

    return build_detect_response(_extract_probability(payload))
