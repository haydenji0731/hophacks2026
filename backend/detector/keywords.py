"""Cheap phrase screen: CLAP audio↔text embeddings (no STT, no TTS, no OWW training)."""

from __future__ import annotations

import io
import json
import logging
import re
import time
import wave
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from settings import settings

logger = logging.getLogger(__name__)

# (label, spoken variants). Fallback if Postgres is empty/down.
# Phone-oriented phrases from Reddit seed + classic call scripts.
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
_PHRASE_TTL_S = 60.0
_MAX_DB_ROWS = 48
_MAX_VARIANTS = 64
_VARIANT_RE = re.compile(r"[a-z0-9]+")
_CLAUSE_SPLIT = re.compile(r"[|;,]")
_SKIP_DEMANDS = {"cash", "other", "check"}
_DEMAND_SPOKEN = {
    "gift_card": ("gift card", "gift cards"),
    "wire": ("wire transfer",),
    "crypto": ("bitcoin",),
}
PHRASE_PATH = Path(__file__).resolve().parent / "clap_phrases.json"

_phrase_cache: tuple[float, tuple[tuple[str, tuple[str, ...]], ...]] | None = None


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


def _norm_variant(text: str) -> str:
    return " ".join(_VARIANT_RE.findall((text or "").lower()))


def _demand_key(demand: object) -> str:
    if demand is None:
        return ""
    value = getattr(demand, "value", None)
    if isinstance(value, str) and value.strip():
        return value.strip().lower()
    return str(demand).strip().lower()


def _description_clauses(description: str) -> list[str]:
    clauses: list[str] = []
    for part in _CLAUSE_SPLIT.split(description or ""):
        spoken = " ".join(part.replace("_", " ").split())
        words = spoken.split()
        if 2 <= len(words) <= 6 and len(spoken) <= 48:
            clauses.append(spoken)
    return clauses


def variants_for_scam(scam: object) -> tuple[str, ...]:
    """Spoken CLAP queries from a DB row — not the catalog slug or generic enums."""
    seen: set[str] = set()
    variants: list[str] = []

    def add(raw: str) -> None:
        spoken = " ".join((raw or "").replace("_", " ").split())
        key = _norm_variant(spoken)
        if not key or len(spoken) > 48 or key in seen:
            return
        seen.add(key)
        variants.append(spoken)

    for demand in getattr(scam, "demands", None) or []:
        key = _demand_key(demand)
        if key in _SKIP_DEMANDS:
            continue
        for spoken in _DEMAND_SPOKEN.get(key, (key.replace("_", " "),)):
            add(spoken)
    for clause in _description_clauses(str(getattr(scam, "description", "") or "")):
        add(clause)
    return tuple(variants)


def merge_phrase_books(
    *books: tuple[tuple[str, tuple[str, ...]], ...] | list[tuple[str, tuple[str, ...]]],
    max_variants: int = _MAX_VARIANTS,
) -> tuple[tuple[str, tuple[str, ...]], ...]:
    """First book wins a spoken string. Later books only add unused variants."""
    claimed: set[str] = set()
    by_label: dict[str, list[str]] = {}
    order: list[str] = []
    count = 0
    for book in books:
        for label, variants in book:
            for variant in variants:
                if count >= max_variants:
                    break
                key = _norm_variant(variant)
                if not key or key in claimed:
                    continue
                claimed.add(key)
                if label not in by_label:
                    by_label[label] = []
                    order.append(label)
                by_label[label].append(variant)
                count += 1
            if count >= max_variants:
                break
        if count >= max_variants:
            break
    return tuple((label, tuple(by_label[label])) for label in order)


def _fetch_db_phrase_book(limit: int = _MAX_DB_ROWS) -> list[tuple[str, tuple[str, ...]]]:
    from paths import DB, prefer_package

    try:
        prefer_package(
            DB,
            drop_modules=("models", "session", "repository", "db_config"),
        )
        from repository import list_scams_for_clap
        from session import get_session_factory
    except Exception:
        return []

    try:
        session = get_session_factory()()
        try:
            rows = list_scams_for_clap(session, limit=limit)
        finally:
            session.close()
    except Exception:
        return []

    book: list[tuple[str, tuple[str, ...]]] = []
    for scam in rows:
        name = str(getattr(scam, "name", "") or "").strip()
        spoken = variants_for_scam(scam)
        if name and spoken:
            book.append((name, spoken))
    return book


def _phrase_path() -> Path:
    override = (getattr(settings, "clap_phrases_path", None) or "").strip()
    return Path(override) if override else PHRASE_PATH


def book_to_payload(
    book: tuple[tuple[str, tuple[str, ...]], ...],
    *,
    source_count: int = 0,
    warnings: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "phrases": [{"label": label, "variants": list(variants)} for label, variants in book],
        "source_count": source_count,
        "warnings": warnings or [],
    }


def payload_to_book(payload: dict[str, Any] | None) -> tuple[tuple[str, tuple[str, ...]], ...]:
    rows = (payload or {}).get("phrases") or []
    book: list[tuple[str, tuple[str, ...]]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        label = str(row.get("label") or "").strip()
        variants = tuple(
            str(v).strip() for v in (row.get("variants") or []) if str(v).strip()
        )
        if label and variants:
            book.append((label, variants))
    return tuple(book)


def load_phrase_file() -> dict[str, Any]:
    path = _phrase_path()
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return {"updated_at": None, "phrases": [], "source_count": 0, "warnings": []}
    if not isinstance(data, dict):
        return {"updated_at": None, "phrases": [], "source_count": 0, "warnings": []}
    return data


def save_phrase_file(payload: dict[str, Any]) -> None:
    path = _phrase_path()
    path.write_text(json.dumps(payload, indent=2) + "\n")
    global _phrase_cache
    _phrase_cache = None


def live_phrases() -> dict[str, Any]:
    stored = load_phrase_file()
    if stored.get("phrases"):
        return stored
    seed = book_to_payload(SCAM_WAKE_PHRASES, source_count=0, warnings=["Using built-in seed; run phrases refresh."])
    seed["updated_at"] = None
    return seed


def refresh_phrases(*, dry_run: bool = False) -> dict[str, Any]:
    warnings: list[str] = []
    db_book = _fetch_db_phrase_book()
    if not db_book:
        warnings.append("Database empty or unavailable; merged seed only.")
    # Seed first so gift card / IRS stay; DB only adds unused spoken strings.
    merged = merge_phrase_books(SCAM_WAKE_PHRASES, db_book)
    if not merged:
        merged = SCAM_WAKE_PHRASES
        warnings.append("Fell back to built-in seed phrases.")
    payload = book_to_payload(merged, source_count=len(db_book), warnings=warnings)
    if not dry_run:
        save_phrase_file(payload)
    return payload


def load_wake_phrases(*, force: bool = False) -> tuple[tuple[str, tuple[str, ...]], ...]:
    """Frozen clap_phrases.json if present, else hardcoded seed. No DB on the hot path."""
    global _phrase_cache
    now = time.monotonic()
    if not force and _phrase_cache is not None:
        cached_at, cached = _phrase_cache
        if now - cached_at < _PHRASE_TTL_S:
            return cached
    book = payload_to_book(load_phrase_file())
    if not book:
        book = SCAM_WAKE_PHRASES
    _phrase_cache = (now, book)
    return book


def current_labels(phrases: tuple[tuple[str, tuple[str, ...]], ...] | None = None) -> set[str]:
    book = phrases if phrases is not None else load_wake_phrases()
    return {label for label, _ in book}


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
def _clap_model():
    from transformers import ClapModel, ClapProcessor

    name = getattr(settings, "clap_model", None) or "laion/clap-htsat-unfused"
    processor = ClapProcessor.from_pretrained(name)
    model = ClapModel.from_pretrained(name)
    model.eval()
    return processor, model


def _queries_from_phrases(
    phrases: tuple[tuple[str, tuple[str, ...]], ...],
) -> tuple[tuple[str, ...], tuple[str, ...], set[str]]:
    queries: list[str] = []
    query_labels: list[str] = []
    labels: set[str] = set()
    for label, variants in phrases:
        labels.add(label)
        for variant in variants:
            queries.append(variant)
            query_labels.append(label)
    return tuple(queries), tuple(query_labels), labels


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
    phrases = load_wake_phrases()
    queries, query_labels, labels = _queries_from_phrases(phrases)
    try:
        processor, model = _clap_model()
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

        max_scores: dict[str, float] = {label: 0.0 for label in labels}
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

        hits = select_hits(max_scores, threshold=cut, target_labels=labels)
        return KeywordSpotResult(
            hits=hits,
            available=True,
            warning=None,
            loaded_labels=sorted(labels),
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
