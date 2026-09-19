# Data Statistics

Numbers from running the pipeline described in [README.md](README.md). Run on 2026-09-19.

## Step 1: `save_dialogues.py`

| | |
|---|---|
| Rows scanned (train + validation) | 19,015 |
| Dialogue IDs requested | 0–99 (100 dialogues) |
| Dialogues found in the mirror | 83 |
| Dialogues not present in the mirror | 17 |
| Turns kept | 775 |
| Complete dialogues (no gaps in turn order) | 83 of 83 |
| Average turns per dialogue | ~9.3 |

**Notes**

- 17 of the requested dialogues don't appear in the mirror at all. This fits with the mirror having fewer clips than the original DailyTalk release; whole dialogues were dropped rather than scattered turns.
- Every dialogue that was found has contiguous turns starting at 0. The check can't detect turns missing from the *end* of a dialogue, since the mirror doesn't record how many turns each dialogue originally had.
- The kept rate (~4% of rows) matches expectations: 100 of roughly 2,500 dialogues.

## Step 2: `make_chunks.py`

Settings: max0 s per chunk, minimum 5 s, 0.3 s pause between turns.

| | |
|---|---|
| Dialogues chunked | 83 |
| Dialogues skipped (missing turns) | 0 |
| Chunks produced | 170 (~2 per dialogue) |
| Total audio | 44.5 min |
| Average chunk length | 15.7 s |
| Average turns per chunk | 4.5 |
| Turns included in chunks | 759 of 775 (98%) |

**Notes**

- The 16 missing turns come from short leftover chunks (under 5 s) at the ends of dialogues, which were dropped.
- Chunks average 15.7 s rather than 20 s because a chunk closes as soon as the next whole turn would push it past the limit.
- Total audio includes the 0.3 s inserted pauses (about 0.3 s × 589 gaps ≈ 3 min).
