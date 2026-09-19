"""openWakeWord keyword spotting on a short audio clip (Linux-oriented)."""

from __future__ import annotations

import io
import logging
import wave
from dataclasses import dataclass, field
from functools import lru_cache

logger = logging.getLogger(__name__)

# Default pretrained labels we care about for scam demos + generic attention words.
# Custom scam phrase models can be added later under MODEL_PATHS.
DEFAULT_TARGET_LABELS = {
    "alexa",
    "hey_mycroft",
    "hey_jarvis",
    "timer",
    "weather",
}


@dataclass
class KeywordHit:
    label: str
    score: float


@dataclass
class KeywordSpotResult:
    hits: list[KeywordHit] = field(default_factory=list)
    available: bool = True
    warning: str | None = None


@lru_cache(maxsize=1)
def _load_oww_model():
    """Prefer ONNX — TFLite/LiteRT often fails on server Python stacks."""
    from openwakeword.model import Model

    return Model(inference_framework="onnx")


def spot_keywords(
    file_bytes: bytes,
    filename: str = "audio.wav",
    content_type: str = "audio/wav",
    *,
    threshold: float = 0.5,
) -> KeywordSpotResult:
    """
    Run openWakeWord on audio bytes. Returns hits above threshold.
    Soft-fails if openWakeWord / onnxruntime unavailable (e.g. macOS 12).
    """
    try:
        import numpy as np  # noqa: F401
        from openwakeword.model import Model  # noqa: F401
    except Exception as exc:
        return KeywordSpotResult(
            hits=[],
            available=False,
            warning=f"openWakeWord unavailable: {exc}",
        )

    try:
        pcm = _to_pcm16_mono_16k(file_bytes, filename, content_type)
    except Exception as exc:
        return KeywordSpotResult(
            hits=[],
            available=False,
            warning=f"audio convert failed for KWS: {exc}",
        )

    try:
        model = _load_oww_model()
        # Feed in ~80ms frames (1280 samples @ 16kHz)
        frame = 1280
        max_scores: dict[str, float] = {}
        for i in range(0, max(len(pcm) - frame, 0) + 1, frame):
            chunk = pcm[i : i + frame]
            if len(chunk) < frame:
                break
            prediction = model.predict(chunk)
            for label, score in prediction.items():
                prev = max_scores.get(label, 0.0)
                if float(score) > prev:
                    max_scores[label] = float(score)

        hits = [
            KeywordHit(label=label, score=score)
            for label, score in sorted(max_scores.items(), key=lambda x: -x[1])
            if score >= threshold
        ]
        return KeywordSpotResult(hits=hits, available=True, warning=None)
    except Exception as exc:
        logger.exception("openWakeWord predict failed")
        return KeywordSpotResult(
            hits=[],
            available=False,
            warning=f"openWakeWord predict failed: {exc}",
        )


def _to_pcm16_mono_16k(file_bytes: bytes, filename: str, content_type: str) -> "np.ndarray":
    import numpy as np

    name = (filename or "").lower()
    is_wav = name.endswith(".wav") or "wav" in (content_type or "")
    if is_wav:
        # Prefer stdlib wave so we don't need ffmpeg for Mac capture WAVs.
        try:
            return _pcm_from_wav_bytes(file_bytes)
        except Exception:
            pass

    from pydub import AudioSegment

    fmt = None
    if is_wav:
        fmt = "wav"
    elif name.endswith(".mp3") or "mpeg" in (content_type or ""):
        fmt = "mp3"

    audio = AudioSegment.from_file(io.BytesIO(file_bytes), format=fmt)
    audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    return np.frombuffer(audio.raw_data, dtype=np.int16)


def _pcm_from_wav_bytes(file_bytes: bytes) -> "np.ndarray":
    import audioop

    import numpy as np

    with wave.open(io.BytesIO(file_bytes), "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        frames = wf.readframes(wf.getnframes())

    if sampwidth != 2:
        frames = audioop.lin2lin(frames, sampwidth, 2)
        sampwidth = 2
    if n_channels > 1:
        frames = audioop.tomono(frames, sampwidth, 0.5, 0.5)
    if framerate != 16000:
        frames, _ = audioop.ratecv(frames, sampwidth, 1, framerate, 16000, None)

    return np.frombuffer(frames, dtype=np.int16)
