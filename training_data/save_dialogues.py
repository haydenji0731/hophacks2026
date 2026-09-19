"""
Stream the DailyTalk mirror and save only the turns belonging to chosen dialogues.

Original filenames look like  {turn}_{speaker}_d{dialogue}.wav
e.g. 10_0_d1080.wav -> turn 10, speaker 0, dialogue 1080

Run:
    uv run --with "datasets[audio]" python save_dialogues.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path

from datasets import Audio, load_dataset

REPO = "HaninZ/DialogueActClassification_DailyTalk"
WANTED = set(range(0, 100))   # dialogue IDs to keep; widen for more data
SPLITS = ["train", "validation"]  # a dialogue's turns may be spread across both

NAME_RE = re.compile(r"(\d+)_(\d+)_d(\d+)\.wav$")

out = Path("dailytalk_slice")
(out / "audio").mkdir(parents=True, exist_ok=True)

found = defaultdict(set)
seen = 0

with open(out / "metadata.jsonl", "w") as meta:
    for split in SPLITS:
        ds = load_dataset(REPO, split=split, streaming=True)
        ds = ds.cast_column("audio", Audio(decode=False))

        for ex in ds:
            seen += 1
            if seen % 2000 == 0:
                print(f"scanned {seen} rows, kept {sum(len(v) for v in found.values())} turns")

            m = NAME_RE.search(ex["audio"]["path"] or "")
            if not m:
                continue
            turn, speaker, dialogue = map(int, m.groups())
            if dialogue not in WANTED:
                continue

            name = f"{turn}_{speaker}_d{dialogue}.wav"
            (out / "audio" / name).write_bytes(ex["audio"]["bytes"])
            found[dialogue].add(turn)

            meta.write(json.dumps({
                "file": f"audio/{name}",
                "dialogue": dialogue,
                "turn": turn,
                "speaker": speaker,
                "label": ex.get("label"),
                "split": split,
            }) + "\n")

complete = [d for d, t in found.items() if t == set(range(max(t) + 1))]
print(f"\nScanned {seen} rows.")
print(f"Kept {sum(len(t) for t in found.values())} turns from {len(found)} dialogues.")
print(f"{len(complete)} dialogues have no missing turns.")
