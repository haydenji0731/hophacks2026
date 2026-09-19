# Data Pipeline

This project trains on two-speaker conversational audio built from **DailyTalk**, a dataset of scripted English dialogues recorded by two speakers. We rebuild full conversations from individual turns and pack them into ~20-second chunks that keep turn boundaries intact.

## Source

| | |
|---|---|
| Dataset | DailyTalk (Lee et al., ICASSP 2023) |
| Original release | https://github.com/keonlee9420/DailyTalk |
| Copy we used | [`HaninZ/DialogueActClassification_DailyTalk`](https://huggingface.co/datasets/HaninZ/DialogueActClassification_DailyTalk) on Hugging Face |
| License | CC-BY-SA 4.0 (DailyTalk) |

We used the Hugging Face copy because it can be streamed, which let us keep only the dialogues we needed instead of downloading and unpacking the full release.

## Pipeline

```
Hugging Face mirror ──► save_dialogues.py ──► dailytalk_slice/ ──► make_chunks.py ──► dailytalk_chunks/
   (one clip per turn)    recover structure,      per-turn WAVs +       pack whole                          keep chosen dialogues   metadata.jsonl        into ~20s chunks      chunks.jsonl
```

### Step 1: `save_dialogues.py`: recover conversations

The mirror was prepared for dialogue-act classification, so each row contains a single turn and its label (`question`, `inform`, `directive`, or `commissive`). The rows carry **no dialogue ID, turn order, speaker, or transcript**, and they appear to be **sorted by label**, so neighboring rows come from unrelated conversations.

The original filenames are still stored in the audio field, though, and they encode the structure:

```
10_0_d1080.wav  →  turn 10, speaker 0, dialogue 1080
```

The script streams both the `train` and `validation` splits once (a dialogue's turns can be split across them), parses each filename, and saves only the turns belonging to the dialogue IDs in `WANTED`. It writes one WAV per turn plus `metadata.jsonl` with `dialogue`, `turn`, `speaker`, `label`, and `split`.

### Step 2: `make_chunks.py`: build ~20 s trainingnits

For each dialogue, turns are sorted and packed in order until the next turn would push the chunk past 20 s, and then a new chunk begins.

- **Turns are never split**; every chunk contains whole turns.
- **Chunks never cross dialogues.**
- **Dialogues with missing turns are skipped**, so no chunk silently jumps over part of a conversation.
- A 0.3 s silence is inserted between turns.
- A single turn longer than 20 s becomes its own chunk, and leftover chunks under 5 s are dropped.

Each chunk gets a WAV file and a line in `chunks.jsonl` with a speaker timeline:

```json
{"file": "audio/d42_c000.wav", "dialogue": 42, "duration": 18.7, "num_turns": 5,
 "segments": [{"start": 0.0, "end": 3.2, "turn": 0, "speaker": 0, ...},
              {"start": 3.5, "end": 7.1, "turn": 1, "speaker": 1, ...}]}
```

## Reproducing

Requires [uv](https://docs.astral.sh/uv/).

```bash
uv sync
uv run python save_dialogues.py   # streams ~5 GB once; saves only chosen dialogues
uv run python make_chunks.py
```

Setting `HF_TOKEN` is optional but gives faster downloads. The generated `dailytalk_slice/` and `dailytalk_chunks/` folders are git-ignored; the scripts regenerate them.

## Resulting data

From dialogue IDs 0–99, the mirror contained **83 dialogues (775 turns)**, all with complete turn sequences. Full numbers for each step are in [statistics.md](statistics.md).

## Known limitations

- **No transcripts.** The mirror dropped the text. Chunks have audio, speaker timelines, and dialogue-act labels only. The official DailyTalk release includes transcripts if they're needed.
- **Artificial pauses.** Turns were recorded as separate files, so the real gaps between speakers are not preserved. The fixed 0.3 s pause means this data can't teach natural turn-taking timing.
- **Scripted speech.** DailyTalk is read by voice actors from written dialogues, so it's cleaner and more regular than spontaneous conversation (few interruptions, overlaps, or backchannels).
- **Two speakers only.** All dialogues use the same pair of speakers,  models trained on it won't generalize well across voices.
- **Incomplete coverage.** The mirror has fewer clips than the original release, so some dialogues have missing turns and are excluded.

## Citation

```bibtex
@inproceedings{lee2023dailytalk,
  title     = {DailyTalk: Spoken Dialogue Dataset for Conversational Text-to-Speech},
  author    = {Lee, Keon and Park, Kyumin and Kim, Daeyoung},
  booktitle = {ICASSP 2023 - IEEE International Conference on Acoustics, Speech and Signal Processing},
  year      = {2023}
}
```

## Related (not this folder)

The Reddit **scam pattern corpus** that seeds Postgres lives under [`backend/db/seeds/`](../backend/db/seeds/) — encyclopedia rows for the site DB, separate from this audio/transcript training pipeline.
