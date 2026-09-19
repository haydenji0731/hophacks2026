# Data Pipeline

This folder holds **audio / transcript eval** for the mid-call detector (DailyTalk chunks, voicemail clips, Grok STT + scam classifier eval).

The Postgres **scam encyclopedia seed** (Reddit / multi-source patterns) lives under [`backend/db/seeds/`](../backend/db/seeds/) — see that README for curation and load steps.

| Track | Job | Primary artifacts |
| --- | --- | --- |
| DailyTalk chunks | Benign two-speaker audio (~20 s) | `save_dialogues.py`, `make_chunks.py` → `dailytalk_*` (gitignored) |
| STT + language eval | Grok transcripts + scam classifier FPR/FNR | `transcribe_wavs.py`, `detect_scam.py`, `eval_fpr.py`, `hard_*_voicemails.jsonl` |
| Hand voicemail clips | Cold-call / voicemail audio + text | `(No Scam) …`, `(Scam) …` pairs |

---

## DailyTalk audio pipeline

Two-speaker conversational audio from **DailyTalk**, rebuilt from per-turn clips into ~20-second chunks that keep turn boundaries intact. Useful as a **soft** benign set (casual dialogue), not as cold-call / voicemail language.

### Source

| | |
|---|---|
| Dataset | DailyTalk (Lee et al., ICASSP 2023) |
| Original release | https://github.com/keonlee9420/DailyTalk |
| Copy we used | [`HaninZ/DialogueActClassification_DailyTalk`](https://huggingface.co/datasets/HaninZ/DialogueActClassification_DailyTalk) on Hugging Face |
| License | CC-BY-SA 4.0 (DailyTalk) |

We used the Hugging Face copy because it can be streamed, which let us keep only the dialogues we needed instead of downloading and unpacking the full release.

### Pipeline

```
Hugging Face mirror ──► save_dialogues.py ──► dailytalk_slice/ ──► make_chunks.py ──► dailytalk_chunks/
   (one clip per turn)    recover structure,      per-turn WAVs +       pack whole
                          keep chosen dialogues   metadata.jsonl        into ~20s chunks
                                                                      chunks.jsonl
```

#### Step 1: `save_dialogues.py`

The mirror was prepared for dialogue-act classification, so each row is a single turn and its label (`question`, `inform`, `directive`, or `commissive`). Rows carry **no dialogue ID, turn order, speaker, or transcript**, and appear sorted by label.

Original filenames still encode structure:

```
10_0_d1080.wav  →  turn 10, speaker 0, dialogue 1080
```

The script streams `train` and `validation`, keeps dialogue IDs in `WANTED`, and writes one WAV per turn plus `metadata.jsonl`.

#### Step 2: `make_chunks.py`

For each dialogue, turns are packed in order until the next turn would exceed 20 s.

- Turns are never split; chunks never cross dialogues.
- Dialogues with missing turns are skipped.
- 0.3 s silence between turns; leftover chunks under 5 s are dropped.

```json
{"file": "audio/d42_c000.wav", "dialogue": 42, "duration": 18.7, "num_turns": 5,
 "segments": [{"start": 0.0, "end": 3.2, "turn": 0, "speaker": 0, ...},
              {"start": 3.5, "end": 7.1, "turn": 1, "speaker": 1, ...}]}
```

### Reproducing

Requires [uv](https://docs.astral.sh/uv/).

```bash
uv sync
uv run python save_dialogues.py   # streams ~5 GB once; saves only chosen dialogues
uv run python make_chunks.py
```

`HF_TOKEN` is optional but speeds downloads. Generated `dailytalk_slice/` and `dailytalk_chunks/` are git-ignored.

### Results & limits

From dialogue IDs 0–99: **83 dialogues (775 turns)** with complete turn sequences. Numbers: [STATS.md](STATS.md).

- The HF mirror dropped transcripts (STT via `transcribe_wavs.py` if needed).
- Fixed 0.3 s pauses; scripted two-speaker speech only; incomplete mirror coverage.

```bibtex
@inproceedings{lee2023dailytalk,
  title     = {DailyTalk: Spoken Dialogue Dataset for Conversational Text-to-Speech},
  author    = {Lee, Keon and Park, Kyumin and Kim, Daeyoung},
  booktitle = {ICASSP 2023 - IEEE International Conference on Acoustics, Speech and Signal Processing},
  year      = {2023}
}
```

---

## Voicemail / cold-call language eval

Hand-labeled outbound voicemails (AI and human) live as paired text + `.mp3` files, named `(No Scam) …` / `(Scam) …`. Harder synthetic text sets:

| File | Role |
| --- | --- |
| `hard_fp_voicemails.jsonl` | Benign institutional voicemails (FPR stress) |
| `hard_tp_voicemails.jsonl` | Scam twins paired by `pair` / domain (FNR sanity) |

Classifier and helpers (need `XAI_API_KEY`):

```bash
uv run --with requests python detect_scam.py
uv run --with requests python transcribe_wavs.py /path/to/wavs /path/to/transcripts.jsonl
uv run --with requests python eval_fpr.py /path/to/transcripts.jsonl /path/to/fpr_results.jsonl
```

DailyTalk transcripts measure **soft** FPR (casual chat). Voicemail sets measure **product-like** FPR/FNR (outbound monologue with money/urgency cues).
