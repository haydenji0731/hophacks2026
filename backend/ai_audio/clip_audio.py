"""Trim leading audio to CLIP_SECONDS before ElevenLabs classification."""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ClipResult:
    data: bytes
    filename: str
    content_type: str
    clipped_seconds: float | None
    original_seconds: float | None
    warning: str | None = None


def clip_leading_audio(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    *,
    seconds: float = 30.0,
) -> ClipResult:
    """
    Return the first `seconds` of audio. On failure or short input, return original bytes.
    Requires pydub + ffmpeg for non-passthrough formats.
    """
    if seconds <= 0 or not file_bytes:
        return ClipResult(
            data=file_bytes,
            filename=filename,
            content_type=content_type,
            clipped_seconds=None,
            original_seconds=None,
            warning="clip skipped",
        )

    try:
        from pydub import AudioSegment
    except ImportError:
        return ClipResult(
            data=file_bytes,
            filename=filename,
            content_type=content_type,
            clipped_seconds=None,
            original_seconds=None,
            warning="pydub not installed; sending full audio to ElevenLabs",
        )

    fmt = _guess_format(filename, content_type)
    try:
        audio = AudioSegment.from_file(io.BytesIO(file_bytes), format=fmt)
    except Exception as exc:
        logger.warning("audio decode failed (%s); using original bytes", exc)
        return ClipResult(
            data=file_bytes,
            filename=filename,
            content_type=content_type,
            clipped_seconds=None,
            original_seconds=None,
            warning=f"decode failed: {exc}",
        )

    duration_s = len(audio) / 1000.0
    if duration_s <= seconds:
        return ClipResult(
            data=file_bytes,
            filename=filename,
            content_type=content_type,
            clipped_seconds=None,
            original_seconds=duration_s,
            warning=None,
        )

    clipped = audio[: int(seconds * 1000)]
    out = io.BytesIO()
    export_format = "wav"
    clipped.export(out, format=export_format)
    out_name = _with_suffix(filename, ".wav")
    return ClipResult(
        data=out.getvalue(),
        filename=out_name,
        content_type="audio/wav",
        clipped_seconds=float(seconds),
        original_seconds=duration_s,
        warning=None,
    )


def _guess_format(filename: str, content_type: str) -> str | None:
    name = (filename or "").lower()
    ctype = (content_type or "").lower()
    if name.endswith(".mp3") or "mpeg" in ctype:
        return "mp3"
    if name.endswith(".wav") or "wav" in ctype:
        return "wav"
    if name.endswith(".ogg") or "ogg" in ctype:
        return "ogg"
    if name.endswith(".webm") or "webm" in ctype:
        return "webm"
    return None


def _with_suffix(filename: str, suffix: str) -> str:
    if "." in filename:
        return filename.rsplit(".", 1)[0] + suffix
    return (filename or "audio") + suffix
