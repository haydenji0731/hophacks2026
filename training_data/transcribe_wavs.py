"""
Transcribe a folder of WAV files with the xAI / Grok Speech-to-Text API.

Requires XAI_API_KEY. Skips files already present in the output jsonl so you
can resume after an interrupt.

Run (from this directory):
    uv run --with requests python transcribe_wavs.py
    uv run --with requests python transcribe_wavs.py /path/to/wavs
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import requests

STT_URL = "https://api.x.ai/v1/stt"
API_KEY = os.environ.get("XAI_API_KEY")
MODEL = "grok-voice-transcribe-2.0"

# Default: chunk WAVs produced by make_chunks.py
audio_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("dailytalk_chunks/audio")
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("dailytalk_chunks/transcripts.jsonl")

LANGUAGE = "en"
FORMAT_TEXT = True   # inverse text normalization ("one hundred dollars" → "$100")
DIARIZE = True       # speaker labels on word timestamps (two-speaker calls)
TIMEOUT_S = 180
RETRIES = 3
RETRY_SLEEP_S = 2.0


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
            if "file" in row and "error" not in row:
                done.add(row["file"])
    return done


def _err_detail(resp: requests.Response) -> str:
    body = (resp.text or "").strip().replace("\n", " ")
    if len(body) > 500:
        body = body[:500] + "…"
    return f"{resp.status_code} {resp.reason}: {body or '(empty body)'}"


def transcribe_wav(path: Path) -> dict:
    if not API_KEY:
        raise SystemExit("Set XAI_API_KEY before running")

    last_err: Exception | None = None
    for attempt in range(1, RETRIES + 1):
        try:
            with path.open("rb") as f:
                # All fields via `files` so `file` is guaranteed last in the multipart body
                # (xAI requires option fields before `file`).
                multipart = [
                    ("model", (None, MODEL)),
                    ("language", (None, LANGUAGE)),
                    ("format", (None, "true" if FORMAT_TEXT else "false")),
                    ("diarize", (None, "true" if DIARIZE else "false")),
                    ("file", (path.name, f, "application/octet-stream")),
                ]
                resp = requests.post(
                    STT_URL,
                    headers={"Authorization": f"Bearer {API_KEY}"},
                    files=multipart,
                    timeout=TIMEOUT_S,
                )
            if resp.status_code == 400:
                # Client error — retrying won't help; surface API message
                raise RuntimeError(_err_detail(resp))
            if resp.status_code == 429 or resp.status_code >= 500:
                raise requests.HTTPError(_err_detail(resp), response=resp)
            if not resp.ok:
                raise RuntimeError(_err_detail(resp))
            return resp.json()
        except requests.RequestException as exc:
            last_err = exc
            if attempt < RETRIES:
                time.sleep(RETRY_SLEEP_S * attempt)
                continue
            raise RuntimeError(f"STT failed for {path.name} after {RETRIES} tries: {last_err}") from exc
        except RuntimeError:
            raise
    raise RuntimeError(f"STT failed for {path.name} after {RETRIES} tries: {last_err}")


def main() -> None:
    if not audio_dir.is_dir():
        raise SystemExit(f"Audio directory not found: {audio_dir.resolve()}")

    wavs = sorted(audio_dir.glob("*.wav"))
    if not wavs:
        raise SystemExit(f"No .wav files in {audio_dir.resolve()}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    done = load_done(out_path)

    # Prefer keys like make_chunks.jsonl: audio/<name>.wav when under the same parent
    def file_key(wav: Path) -> str:
        try:
            return str(wav.resolve().relative_to(out_path.parent.resolve()))
        except ValueError:
            return wav.name

    remaining = [w for w in wavs if file_key(w) not in done]
    print(f"{len(wavs)} wavs, {len(done)} already done, {len(remaining)} to transcribe")
    print(f"Writing → {out_path.resolve()}")

    ok, failed = 0, 0
    with out_path.open("a") as out:
        for i, wav in enumerate(remaining, 1):
            key = file_key(wav)
            try:
                result = transcribe_wav(wav)
                row = {
                    "file": key,
                    "text": result.get("text", ""),
                    "language": result.get("language"),
                    "duration": result.get("duration"),
                    "words": result.get("words"),
                    "channels": result.get("channels"),
                }
                out.write(json.dumps(row) + "\n")
                out.flush()
                ok += 1
                preview = (row["text"] or "")[:80].replace("\n", " ")
                print(f"[{i}/{len(remaining)}] {key} ({row.get('duration')}s) {preview}")
            except Exception as exc:
                failed += 1
                print(f"[{i}/{len(remaining)}] FAIL {key}: {exc}")

    print(f"Done. ok={ok} failed={failed} total_in_file≈{len(done) + ok}")


if __name__ == "__main__":
    main()
