"""openWakeWord keyword spotting on a short audio clip (Linux-oriented)."""

from __future__ import annotations

import io
import logging
import wave
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from settings import settings

logger = logging.getLogger(__name__)

# Phrases we actually care about for the screen (not stock alexa/jarvis).
# openWakeWord needs a trained .onnx per label; drop files in wakeword_models/.
SCAM_WAKE_PHRASES: tuple[tuple[str, str], ...] = (
    ("gift_card", "gift card"),
    ("google_play", "google play"),
    ("social_security", "social security"),
    ("irs", "I R S"),
    ("arrest_warrant", "arrest warrant"),
    ("dont_tell", "don't tell"),
    ("wire_transfer", "wire transfer"),
    ("verification_code", "verification code"),
    ("your_grandson", "your grandson"),
    ("bail", "bail"),
)

TARGET_LABELS = {label for label, _ in SCAM_WAKE_PHRASES}


@dataclass
class KeywordHit:
    label: str
    score: float


@dataclass
class KeywordSpotResult:
    hits: list[KeywordHit] = field(default_factory=list)
    available: bool = True
    warning: str | None = None
    loaded_labels: list[str] = field(default_factory=list)


def _model_dir() -> Path:
    raw = getattr(settings, "wakeword_model_dir", "") or ""
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parent / "wakeword_models"


def discover_custom_models() -> list[str]:
    directory = _model_dir()
    if not directory.is_dir():
        return []
    return sorted(str(path) for path in directory.glob("*.onnx"))


def select_hits(
    max_scores: dict[str, float],
    *,
    threshold: float,
    target_labels: set[str] | None = None,
) -> list[KeywordHit]:
    wanted = TARGET_LABELS if target_labels is None else target_labels
    hits = [
        KeywordHit(label=label, score=score)
        for label, score in sorted(max_scores.items(), key=lambda x: -x[1])
        if score >= threshold and (not wanted or label in wanted or _slug(label) in wanted)
    ]
    return hits


def _slug(label: str) -> str:
    return label.lower().replace(" ", "_").replace("-", "_")


@lru_cache(maxsize=1)
def _load_oww_model():
    """Load custom scam-phrase ONNX models only (not stock alexa/weather)."""
    from openwakeword.model import Model

    paths = discover_custom_models()
    if not paths:
        return None
    return Model(wakeword_models=paths, inference_framework="onnx")


def spot_keywords(
    file_bytes: bytes,
    filename: str = "audio.wav",
    content_type: str = "audio/wav",
    *,
    threshold: float | None = None,
) -> KeywordSpotResult:
    """
    Run openWakeWord on audio bytes. Returns hits above threshold.
    Soft-fails if openWakeWord / onnxruntime unavailable (e.g. macOS 12).
    """
    cut = settings.wakeword_threshold if threshold is None else threshold
    try:
        import numpy as np  # noqa: F401
        from openwakeword.model import Model  # noqa: F401
    except Exception as exc:
        return KeywordSpotResult(
            hits=[],
            available=False,
            warning=f"openWakeWord unavailable: {exc}",
        )

    model = _load_oww_model()
    if model is None:
        phrases = ", ".join(phrase for _, phrase in SCAM_WAKE_PHRASES)
        return KeywordSpotResult(
            hits=[],
            available=False,
            warning=(
                "No scam-phrase openWakeWord models. "
                f"Add .onnx files under {_model_dir()} for: {phrases}. "
                "Stock alexa/jarvis models are not used."
            ),
        )

    try:
        pcm = _to_pcm16_mono_16k(file_bytes, filename, content_type)
    except Exception as exc:
        return KeywordSpotResult(
            hits=[],
            available=False,
            warning=f"audio convert failed for KWS: {exc}",
        )

    loaded = [str(name) for name in getattr(model, "models", {}).keys()]
    try:
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

        hits = select_hits(max_scores, threshold=cut, target_labels=set())
        return KeywordSpotResult(
            hits=hits,
            available=True,
            warning=None,
            loaded_labels=loaded,
        )
    except Exception as exc:
        logger.exception("openWakeWord predict failed")
        return KeywordSpotResult(
            hits=[],
            available=False,
            warning=f"openWakeWord predict failed: {exc}",
            loaded_labels=loaded,
        )


def _to_pcm16_mono_16k(file_bytes: bytes, filename: str, content_type: str) -> "np.ndarray":
    import numpy as np

    name = (filename or "").lower()
    is_wav = name.endswith(".wav") or "wav" in (content_type or "")
    if is_wav:
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
