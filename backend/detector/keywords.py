"""openWakeWord keyword spotting on a short audio clip (Linux-oriented)."""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field

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
        import numpy as np
        from openwakeword.model import Model
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
        model = Model()
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
    from pydub import AudioSegment

    fmt = None
    name = (filename or "").lower()
    if name.endswith(".wav") or "wav" in (content_type or ""):
        fmt = "wav"
    elif name.endswith(".mp3") or "mpeg" in (content_type or ""):
        fmt = "mp3"

    audio = AudioSegment.from_file(io.BytesIO(file_bytes), format=fmt)
    audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    samples = np.frombuffer(audio.raw_data, dtype=np.int16)
    return samples
