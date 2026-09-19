"""
Precision / recall for ElevenLabs AI-speech classification on labeled voicemails.

Labels from filename (same convention as Human/AI transcript pairs):
  *Human* → expected AI = False
  *AI*    → expected AI = True

Positive class = AI voice.
  - Pred yes  (score >= YES_THRESHOLD, default 0.70) → AI
  - Pred no   (score <= NO_THRESHOLD, default 0.30) → human
  - Pred unknown → counted separately (not in P/R)

Uses backend/ai_audio.classify_audio (clips first CLIP_SECONDS, default 30s, then ElevenLabs).

Run (from this directory):
    # needs ELEVENLABS_API_KEY optional; ffmpeg for clip; network
    uv run --with httpx --with pydantic-settings --with python-dotenv --with pydub \\
      python eval_elevenlabs.py

    # or from ai_audio venv after pip install -r requirements.txt:
    cd ../backend/ai_audio && source .venv/bin/activate
    cd ../../training_data && python eval_elevenlabs.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AI_AUDIO = ROOT.parent / "backend" / "ai_audio"
RETRIES = 3
RETRY_SLEEP_S = 2.0

# Match ai_audio defaults; override via env YES_THRESHOLD / NO_THRESHOLD if settings load them.
YES_THRESHOLD = 0.70
NO_THRESHOLD = 0.30


def discover_cases() -> list[tuple[Path, bool]]:
    """Return (mp3_path, expect_ai)."""
    cases: list[tuple[Path, bool]] = []
    for path in sorted(ROOT.glob("*.mp3")):
        name = path.stem
        if "Human" in name:
            cases.append((path, False))
        elif "AI" in name and "Human" not in name:
            cases.append((path, True))
    return cases


def _import_classify():
    sys.path.insert(0, str(AI_AUDIO))
    from classifier import ClassifierError, classify_audio

    return classify_audio, ClassifierError


def classify_file(path: Path) -> dict:
    classify_audio, ClassifierError = _import_classify()
    data = path.read_bytes()
    last_err: Exception | None = None
    for attempt in range(1, RETRIES + 1):
        try:
            result = classify_audio(data, path.name, "audio/mpeg")
            return {
                "elevenlabs_ai_score": result.elevenlabs_ai_score,
                "ai_voice_used": result.ai_voice_used,
                "clipped_seconds": getattr(result, "clipped_seconds", None),
            }
        except ClassifierError as exc:
            last_err = exc
            if attempt < RETRIES:
                time.sleep(RETRY_SLEEP_S * attempt)
                continue
            raise
        except Exception as exc:
            last_err = exc
            if attempt < RETRIES:
                time.sleep(RETRY_SLEEP_S * attempt)
                continue
            raise RuntimeError(f"classify failed for {path.name}: {last_err}") from exc
    raise RuntimeError(f"classify failed for {path.name}: {last_err}")


def pred_is_ai(ai_voice_used: str, score: float) -> bool | None:
    """True=AI, False=human, None=unknown."""
    if ai_voice_used == "yes" or score >= YES_THRESHOLD:
        return True
    if ai_voice_used == "no" or score <= NO_THRESHOLD:
        return False
    return None


def main() -> None:
    cases = discover_cases()
    if not cases:
        raise SystemExit(
            f"No labeled .mp3 files in {ROOT} "
            "(expected names containing 'Human' or 'AI')."
        )

    tp = tn = fp = fn = 0
    unk_ai = unk_human = 0
    errors = 0
    rows: list[dict] = []

    n_ai = sum(1 for _, e in cases if e)
    n_human = sum(1 for _, e in cases if not e)
    print(
        f"cases={len(cases)} (AI={n_ai}, Human={n_human})  "
        f"yes>={YES_THRESHOLD} no<={NO_THRESHOLD}\n"
    )

    for path, expect_ai in cases:
        label = "AI" if expect_ai else "Human"
        try:
            result = classify_file(path)
            score = float(result["elevenlabs_ai_score"])
            used = str(result["ai_voice_used"])
            pred = pred_is_ai(used, score)
        except Exception as exc:
            errors += 1
            print(f"ERROR  {path.name}: {exc}")
            continue

        if pred is None:
            if expect_ai:
                unk_ai += 1
            else:
                unk_human += 1
            verdict = "UNKNOWN"
        elif expect_ai and pred:
            tp += 1
            verdict = "TP"
        elif not expect_ai and not pred:
            tn += 1
            verdict = "TN"
        elif not expect_ai and pred:
            fp += 1
            verdict = "FP"
        else:
            fn += 1
            verdict = "FN"

        rows.append(
            {
                "file": path.name,
                "label": label,
                "expect_ai": expect_ai,
                "score": score,
                "ai_voice_used": used,
                "verdict": verdict,
            }
        )
        print(
            f"{verdict:8} label={label:5} score={score:.3f} used={used:7}  {path.name}"
        )

    precision = tp / (tp + fp) if (tp + fp) else None
    recall = tp / (tp + fn) if (tp + fn) else None
    # unknowns as misses for AI (FN) / as FP for Human optional
    recall_unk_as_fn = tp / (tp + fn + unk_ai) if (tp + fn + unk_ai) else None
    precision_unk_excl = precision

    f1 = None
    if precision is not None and recall is not None and (precision + recall) > 0:
        f1 = 2 * precision * recall / (precision + recall)

    summary = {
        "n": len(cases),
        "n_ai": n_ai,
        "n_human": n_human,
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
        "unknown_on_ai": unk_ai,
        "unknown_on_human": unk_human,
        "errors": errors,
        "precision": None if precision is None else round(precision, 4),
        "recall": None if recall is None else round(recall, 4),
        "f1": None if f1 is None else round(f1, 4),
        "recall_unknown_as_fn": None
        if recall_unk_as_fn is None
        else round(recall_unk_as_fn, 4),
        "yes_threshold": YES_THRESHOLD,
        "no_threshold": NO_THRESHOLD,
        "note": "Positive class = AI. Unknown band excluded from precision/recall unless noted.",
    }

    out_path = ROOT / "elevenlabs_eval_results.jsonl"
    with out_path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")
        f.write(json.dumps({"summary": summary}) + "\n")

    print("\n=== ElevenLabs AI-voice metrics (positive = AI) ===")
    print(json.dumps(summary, indent=2))
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
