"""
Pack DailyTalk turns into ~20-second chunks.

- Turns are never split: a chunk always contains whole turns.
- Chunks never cross dialogue boundaries.
- Each chunk gets a WAV file plus a timeline of who spoke when.

Run:
    uv run --with soundfile --with numpy python make_chunks.py
"""

import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import soundfile as sf

# ---- adjust these to match your metadata columns ----
DIALOGUE_COL = "dialogue"
TURN_COL = "turn"
SPEAKER_COL = "speaker"   # set to None if there is no speaker column
TEXT_COL = None           # this mirror has no transcripts
SKIP_INCOMPLETE = True    # skip dialogues with missing turns
# -----------------------------------------------------

MAX_SECONDS = 20.0   # target chunk length
MIN_SECONDS = 5.0    # drop leftover chunks shorter than this (set 0 to keep all)
PAUSE_SECONDS = 0.3  # silence inserted between turns

src = Path("dailytalk_slice")
out = Path("dailytalk_chunks")
(out / "audio").mkdir(parents=True, exist_ok=True)


def load_turn(row):
    audio, sr = sf.read(src / row["file"])
    if audio.ndim > 1:  # stereo -> mono
        audio = audio.mean(axis=1)
    return audio, sr


def write_chunk(chunk_turns, dialogue_id, chunk_idx, meta_file):
    pieces, segments, sr, t = [], [], None, 0.0
    for row, audio, turn_sr in chunk_turns:
        if sr is None:
            sr = turn_sr
        assert turn_sr == sr, f"Sample rate mismatch in dialogue {dialogue_id}"
        if pieces:
            pieces.append(np.zeros(int(PAUSE_SECONDS * sr)))
            t += PAUSE_SECONDS
        dur = len(audio) / sr
        segments.append({
            "start": round(t, 3),
            "end": round(t + dur, 3),
            "turn": row[TURN_COL],
            "speaker": row.get(SPEAKER_COL) if SPEAKER_COL else None,
            "text": row.get(TEXT_COL) if TEXT_COL else None,
        })
        pieces.append(audio)
        t += dur

    name = f"d{dialogue_id}_c{chunk_idx:03d}.wav"
    sf.write(out / "audio" / name, np.concatenate(pieces), sr)
    meta_file.write(json.dumps({
        "file": f"audio/{name}",
        "dialogue": dialogue_id,
        "duration": round(t, 3),
        "num_turns": len(segments),
        "segments": segments,
    }, default=str) + "\n")


rows = [json.loads(line) for line in open(src / "metadata.jsonl")]
dialogues = defaultdict(list)
for r in rows:
    dialogues[r[DIALOGUE_COL]].append(r)

n_chunks = 0
skipped = 0
with open(out / "chunks.jsonl", "w") as meta:
    for dialogue_id, turns in dialogues.items():
        turns.sort(key=lambda r: int(r[TURN_COL]))
        turn_ids = [int(r[TURN_COL]) for r in turns]
        if SKIP_INCOMPLETE and turn_ids != list(range(len(turn_ids))):
            skipped += 1
            continue
        current, current_len, chunk_idx = [], 0.0, 0

        for row in turns:
            audio, sr = load_turn(row)
            dur = len(audio) / sr
            added = dur + (PAUSE_SECONDS if current else 0.0)

            # Adding this turn would exceed the limit -> close the current chunk
            if current and current_len + added > MAX_SECONDS:
                write_chunk(current, dialogue_id, chunk_idx, meta)
                chunk_idx += 1
                n_chunks += 1
                current, current_len = [], 0.0
                added = dur

            # A single turn longer than MAX_SECONDS still becomes its own chunk
            current.append((row, audio, sr))
            current_len += added

        if current and current_len >= MIN_SECONDS:
            write_chunk(current, dialogue_id, chunk_idx, meta)
            n_chunks += 1

print(f"Wrote {n_chunks} chunks from {len(dialogues) - skipped} dialogues to {out.resolve()}")
if skipped:
    print(f"Skipped {skipped} dialogues with missing turns")
