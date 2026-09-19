"""
Measure false-positive rate of detect_scam on benign DailyTalk transcripts.

Assumes every transcript is non-scam (DailyTalk scripted dialogue).
Skips files already present in the results jsonl so you can resume.

Run (from this directory):
    uv run --with requests python eval_fpr.py \\
      /Volumes/T7/dailytalk_chunks/transcripts.jsonl \\
      /Volumes/T7/dailytalk_chunks/fpr_results.jsonl
"""

from __future__ import annotations

import json
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

from detect_scam import detect_scam

THRESHOLDS = (0.5, 0.7, 0.9)

transcripts_path = (
    Path(sys.argv[1]) if len(sys.argv) > 1 else Path("dailytalk_chunks/transcripts.jsonl")
)
out_path = (
    Path(sys.argv[2]) if len(sys.argv) > 2 else Path("dailytalk_chunks/fpr_results.jsonl")
)

RETRIES = 3
RETRY_SLEEP_S = 2.0
DIALOGUE_RE = re.compile(r"d(\d+)_")


def load_done(path: Path) -> set[str]:
    done: set[str] = set()
    if not path.exists():
        return done
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            if row.get("file") and "error" not in row:
                done.add(row["file"])
    return done


def load_transcripts(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            text = (row.get("text") or "").strip()
            if not text or "error" in row:
                continue
            rows.append(row)
    return rows


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


def dialogue_id(file_key: str) -> str | None:
    m = DIALOGUE_RE.search(file_key)
    return m.group(1) if m else None


def summarize(results: list[dict]) -> None:
    n = len(results)
    if n == 0:
        print("No successful results to summarize.")
        return

    preds = [bool(r.get("is_scam")) for r in results]
    confs = []
    for r in results:
        try:
            confs.append(float(r.get("confidence", 0.0)))
        except (TypeError, ValueError):
            confs.append(0.0)

    raw_fp = sum(preds)
    print(f"\n=== FPR summary (benign-only, n={n}) ===")
    print(f"raw is_scam=true: {raw_fp}/{n}  FPR={raw_fp / n:.3f}")

    for thr in THRESHOLDS:
        fp = sum(1 for p, c in zip(preds, confs) if p and c >= thr)
        print(f"is_scam & confidence>={thr}: {fp}/{n}  FPR={fp / n:.3f}")

    by_dialogue: dict[str, list[bool]] = defaultdict(list)
    for r, p in zip(results, preds):
        d = dialogue_id(str(r.get("file", ""))) or "?"
        by_dialogue[d].append(p)
    dialogues_with_fp = sum(1 for flags in by_dialogue.values() if any(flags))
    print(
        f"dialogues with ≥1 FP: {dialogues_with_fp}/{len(by_dialogue)}  "
        f"rate={dialogues_with_fp / len(by_dialogue):.3f}"
    )

    fps = [r for r, p in zip(results, preds) if p]
    if fps:
        print(f"\n--- False positives ({len(fps)}) ---")
        for r in fps:
            preview = (r.get("text") or "")[:100].replace("\n", " ")
            print(
                f"{r.get('file')}  conf={r.get('confidence')}  "
                f"type={r.get('scam_type')}\n  reason: {r.get('reasoning')}\n  text: {preview}"
            )


def main() -> None:
    if not transcripts_path.is_file():
        raise SystemExit(f"Transcripts not found: {transcripts_path.resolve()}")

    rows = load_transcripts(transcripts_path)
    if not rows:
        raise SystemExit(f"No usable transcripts in {transcripts_path.resolve()}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    done = load_done(out_path)
    remaining = [r for r in rows if r.get("file") not in done]
    print(
        f"{len(rows)} transcripts, {len(done)} already done, "
        f"{len(remaining)} to classify"
    )
    print(f"Writing → {out_path.resolve()}")

    ok, failed = 0, 0
    with out_path.open("a") as out:
        for i, row in enumerate(remaining, 1):
            key = row["file"]
            text = row["text"].strip()
            try:
                pred = classify(text)
                result = {
                    "file": key,
                    "text": text,
                    "is_scam": bool(pred.get("is_scam")),
                    "confidence": pred.get("confidence"),
                    "scam_type": pred.get("scam_type"),
                    "method": pred.get("method"),
                    "target": pred.get("target"),
                    "reasoning": pred.get("reasoning"),
                    "label": False,  # benign corpus
                }
                out.write(json.dumps(result) + "\n")
                out.flush()
                ok += 1
                flag = "FP" if result["is_scam"] else "ok"
                print(
                    f"[{i}/{len(remaining)}] {flag} {key} "
                    f"conf={result['confidence']} type={result['scam_type']}"
                )
            except Exception as exc:
                failed += 1
                print(f"[{i}/{len(remaining)}] FAIL {key}: {exc}")

    # Reload full results file for summary (includes prior runs)
    all_results = []
    if out_path.exists():
        with out_path.open() as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                row = json.loads(line)
                if "error" not in row and "is_scam" in row:
                    all_results.append(row)

    print(f"\nDone. ok={ok} failed={failed}")
    summarize(all_results)


if __name__ == "__main__":
    main()
