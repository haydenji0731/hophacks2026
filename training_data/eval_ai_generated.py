"""
Eval detect_scam.ai_generated on labeled Human vs AI transcripts.

Label from filename:
  *Human* → expected ai_generated=False
  *AI*    → expected ai_generated=True

Positive class = AI. Unknown predictions are counted separately (not TP/TN/FP/FN).

Run (from this directory):
    uv run --with requests python eval_ai_generated.py
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from detect_scam import detect_scam

ROOT = Path(__file__).resolve().parent
RETRIES = 3
RETRY_SLEEP_S = 2.0


def discover_cases() -> list[tuple[Path, bool]]:
    cases: list[tuple[Path, bool]] = []
    for path in sorted(ROOT.iterdir()):
        if not path.is_file() or path.suffix:
            continue
        name = path.name
        if "Human" in name:
            cases.append((path, False))
        elif " AI " in f" {name} " or name.startswith("(Scam) AI") or name.startswith("(No Scam) AI"):
            cases.append((path, True))
        elif "AI" in name and "Human" not in name:
            cases.append((path, True))
    return cases


def normalize_ai_pred(value) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"true", "yes", "y", "1"}:
            return True
        if v in {"false", "no", "n", "0"}:
            return False
        if v in {"unknown", "unclear", "n/a", ""}:
            return None
    return None


def classify(text: str) -> dict:
    last_err: Exception | None = None
    for attempt in range(1, RETRIES + 1):
        try:
            return detect_scam(text)
        except Exception as exc:
            last_err = exc
            if attempt < RETRIES:
                time.sleep(RETRY_SLEEP_S * attempt)
    raise RuntimeError(f"detect_scam failed after {RETRIES} tries: {last_err}")


def main() -> None:
    cases = discover_cases()
    if not cases:
        raise SystemExit("No Human/AI transcript files found")

    tp = tn = fp = fn = 0
    unk_ai = unk_human = 0
    errors = 0

    print(f"cases={len(cases)} (AI expected={sum(1 for _, e in cases if e)}, Human expected={sum(1 for _, e in cases if not e)})\n")

    for path, expect_ai in cases:
        label = "AI" if expect_ai else "Human"
        try:
            text = path.read_text(encoding="utf-8").strip()
            result = classify(text)
            pred = normalize_ai_pred(result.get("ai_generated"))
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

        print(
            f"{verdict:8} label={label:5} pred={result.get('ai_generated')!r:10}  {path.name}"
        )
        print(f"         scam={result.get('is_scam')} conf={result.get('confidence')} type={result.get('scam_type')}")

    n_human = sum(1 for _, e in cases if not e)
    n_ai = sum(1 for _, e in cases if e)
    # Rates among labeled samples; unknowns excluded from TP/TN/FP/FN but shown
    fpr = fp / n_human if n_human else 0.0  # said AI on Human (incl. only hard FP; unk not in FP)
    fnr = fn / n_ai if n_ai else 0.0
    # Alternate: treat unknown as miss
    fpr_unk_as_fp = (fp + unk_human) / n_human if n_human else 0.0
    fnr_unk_as_fn = (fn + unk_ai) / n_ai if n_ai else 0.0

    decided = tp + tn + fp + fn
    acc_decided = (tp + tn) / decided if decided else 0.0

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
        "fpr_hard": round(fpr, 4),
        "fnr_hard": round(fnr, 4),
        "fpr_unknown_as_error": round(fpr_unk_as_fp, 4),
        "fnr_unknown_as_error": round(fnr_unk_as_fn, 4),
        "accuracy_excluding_unknown": round(acc_decided, 4),
    }

    print("\n=== ai_generated metrics (positive class = AI) ===")
    print(json.dumps(summary, indent=2))
    print(
        "\nHard FPR = FP/n_human (predicted true on Human only; unknown not counted as FP)."
        "\nHard FNR = FN/n_ai (predicted false on AI only; unknown not counted as FN)."
        "\n*_unknown_as_error counts unknown as the corresponding error."
    )


if __name__ == "__main__":
    main()
