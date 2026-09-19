"""Grok / xAI speech-to-text for escalate path."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import requests

from settings import settings


class STTError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def transcribe_audio_bytes(
    file_bytes: bytes,
    filename: str = "audio.wav",
    *,
    api_key: str | None = None,
) -> str:
    """
    Transcribe audio via xAI STT. Returns plain text (may be empty).
    """
    key = api_key or settings.xai_api_key or os.environ.get("XAI_API_KEY")
    if not key:
        raise STTError("XAI_API_KEY is not set")

    suffix = Path(filename).suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(file_bytes)
        tmp.flush()
        tmp.seek(0)
        multipart = [
            ("model", (None, settings.stt_model)),
            ("language", (None, "en")),
            ("format", (None, "true")),
            ("diarize", (None, "false")),
            ("file", (filename or f"audio{suffix}", tmp, "application/octet-stream")),
        ]
        try:
            resp = requests.post(
                settings.stt_url,
                headers={"Authorization": f"Bearer {key}"},
                files=multipart,
                timeout=settings.stt_timeout_seconds,
            )
        except requests.RequestException as exc:
            raise STTError(f"STT request failed: {exc}") from exc

    if resp.status_code >= 400:
        body = (resp.text or "").strip()[:500]
        raise STTError(f"STT HTTP {resp.status_code}: {body or resp.reason}")

    try:
        payload = resp.json()
    except ValueError as exc:
        raise STTError("STT returned non-JSON") from exc

    text = (payload.get("text") or "").strip()
    return text
