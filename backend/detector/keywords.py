"""Cheap phrase screen: CLAP audio↔text embeddings (no STT, no TTS, no OWW training)."""

from __future__ import annotations

import io
import logging
import wave
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np

from settings import settings

logger = logging.getLogger(__name__)

# (label, spoken variants). Phone-oriented phrases from Reddit seed + classic call scripts.
SCAM_WAKE_PHRASES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("gift_card", ("gift card", "gift cards", "google play")),
    ("wire_transfer", ("wire transfer", "western union")),
    ("social_security", ("social security",)),
    ("irs", ("I R S", "internal revenue service")),
    ("arrest_warrant", ("arrest warrant",)),
    ("dont_tell", ("don't tell anyone", "keep this secret")),
    ("verification_code", ("verification code",)),
    ("your_grandson", ("your grandson",)),
    ("pay_bail", ("pay bail", "bail money")),
    ("fraud_department", ("fraud department",)),
    ("delivery_fee", ("delivery fee", "customs duty")),
    ("remote_access", ("remote access", "team viewer")),
    ("account_suspended", ("account suspended",)),
    ("shut_off", ("power shut off", "utility disconnection")),
    ("identity_theft", ("identity theft",)),
    ("extended_warranty", ("extended warranty",)),
    ("bitcoin_atm", ("bitcoin A T M",)),
    ("face_time", ("face time",)),
    ("process_server", ("process server",)),
    ("refund_department", ("refund department",)),
)

TARGET_LABELS = {label for label, _ in SCAM_WAKE_PHRASES}

_CLAP_SR = 48000
_WIN_S = 5.0
_HOP_S = 2.5


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


def select_hits(
    max_scores: dict[str, float],
    *,
    threshold: float,
    target_labels: set[str] | None = None,
) -> list[KeywordHit]:
    wanted = TARGET_LABELS if target_labels is None else target_labels
    return [
        KeywordHit(label=label, score=score)
        for label, score in sorted(max_scores.items(), key=lambda x: -x[1])
        if score >= threshold and (not wanted or label in wanted)
    ]


@lru_cache(maxsize=1)
def _load_clap():
    from transformers import ClapModel, ClapProcessor

    name = getattr(settings, "clap_model", None) or "laion/clap-htsat-unfused"
    processor = ClapProcessor.from_pretrained(name)
    model = ClapModel.from_pretrained(name)
    model.eval()
    queries: list[str] = []
    query_labels: list[str] = []
    for label, variants in SCAM_WAKE_PHRASES:
        for variant in variants:
            queries.append(variant)
            query_labels.append(label)
    return processor, model, tuple(queries), tuple(query_labels)


def spot_keywords(
    file_bytes: bytes,
    filename: str = "audio.wav",
    content_type: str = "audio/wav",
    *,
    threshold: float | None = None,
) -> KeywordSpotResult:
    """
    Score sliding audio windows against phrase text via CLAP logits (no STT).
    Soft-fails if transformers/torch/CLAP are missing.
    """
    cut = settings.clap_threshold if threshold is None else threshold
    try:
        processor, model, queries, query_labels = _load_clap()
    except Exception as exc:
        return KeywordSpotResult(
            hits=[],
            available=False,
            warning=(
                f"CLAP phrase spotter unavailable ({exc}). "
                "On Linux: uv sync --extra kws"
            ),
        )

    try:
        pcm16 = _to_pcm16_mono_16k(file_bytes, filename, content_type)
        audio_48k = _resample_to_48k(pcm16)
    except Exception as exc:
        return KeywordSpotResult(
            hits=[],
            available=False,
            warning=f"audio convert failed for CLAP: {exc}",
        )

    try:
        import torch

        max_scores: dict[str, float] = {label: 0.0 for label in TARGET_LABELS}
        query_list = list(queries)
        for window in _iter_windows(audio_48k, _CLAP_SR, _WIN_S, _HOP_S):
            inputs = processor(
                text=query_list,
                audio=window.astype(np.float32),
                sampling_rate=_CLAP_SR,
                return_tensors="pt",
                padding=True,
            )
            with torch.no_grad():
                out = model(**inputs)
            if getattr(out, "logits_per_audio", None) is not None:
                sims = out.logits_per_audio.squeeze(0).cpu().numpy()
            else:
                audio_emb = torch.nn.functional.normalize(out.audio_embeds.float(), dim=-1)
                text_emb = torch.nn.functional.normalize(out.text_embeds.float(), dim=-1)
                sims = (audio_emb @ text_emb.T).squeeze(0).cpu().numpy()
            sims = np.atleast_1d(np.asarray(sims, dtype=np.float64))
            for score, label in zip(sims.tolist(), query_labels):
                prev = max_scores.get(label, 0.0)
                if float(score) > prev:
                    max_scores[label] = float(score)

        hits = select_hits(max_scores, threshold=cut)
        return KeywordSpotResult(
            hits=hits,
            available=True,
            warning=None,
            loaded_labels=sorted(TARGET_LABELS),
        )
    except Exception as exc:
        logger.exception("CLAP phrase spot failed")
        return KeywordSpotResult(
            hits=[],
            available=False,
            warning=f"CLAP phrase spotter failed: {exc}",
        )


def _iter_windows(audio: np.ndarray, sr: int, win_s: float, hop_s: float):
    win = int(win_s * sr)
    hop = int(hop_s * sr)
    if len(audio) <= win:
        yield audio.astype(np.float32)
        return
    last = 0
    for start in range(0, len(audio) - win + 1, hop):
        yield audio[start : start + win].astype(np.float32)
        last = start
    tail = audio[last + hop :]
    if len(tail) >= sr:
        yield tail.astype(np.float32)


def _resample_to_48k(pcm16: np.ndarray) -> np.ndarray:
    x = pcm16.astype(np.float32)
    n = len(x)
    if n == 0:
        return x
    t_new = np.linspace(0, n - 1, n * 3)
    return np.interp(t_new, np.arange(n), x) / 32768.0


def _to_pcm16_mono_16k(file_bytes: bytes, filename: str, content_type: str) -> np.ndarray:
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


def _pcm_from_wav_bytes(file_bytes: bytes) -> np.ndarray:
    import audioop

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
