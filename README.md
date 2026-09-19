# We Hate Scammers

**You think you're being scammed? Find out here.**

HopHacks 2026 project. Working name: [wehatescammers.com](https://wehatescammers.com) (pending).

A mid-call warning system plus a public, searchable encyclopedia of how scams actually work. We detect synthetic voices, scripted pressure, and known scam patterns *while the interaction is happening*, then send people somewhere they can check what they heard and teach the corpus for the next person.

Inspired by [Have I Been Pwned](https://haveibeenpwned.com) (trust, clarity) and Akinator (adaptive questions).

---

## The problem

Scams no longer sound like scams. Callers use AI voices, urgency scripts, and familiar institutions (banks, IRS, “your grandson”). Carrier spam labels miss the conversation itself. After the call, victims still do not have a place to match *what just happened* to a known pattern.

## What we built toward

| Surface | Job |
| --- | --- |
| **Live phone / text flag** | Score the audio and language in the moment. If it looks like a scam, notify the user and deep-link to the site. |
| **Website questionnaire** | “Am I being scammed?” — adaptive questions + optional free-text details → most likely scam type and why. |
| **Public scam repository** | Browse and search cleaned, categorized incidents (how it unfolds, signals, what to do). |
| **Learning loop** | Confirmed cases go through Grok to strip PII, categorize, embed, and upsert so detection and the questionnaire get better. |

**Who it is for**

1. Someone on a suspicious call or text who needs a warning *now*.
2. Someone unsure after the fact who wants a walkthrough.
3. Anyone who wants to look up how a scam type works.

We are **not** replacing carrier blocking or OS call screening, and we do not claim zero false positives.

---

## How detection works

```
Call / text
    → ElevenLabs AI-voice score on audio
    → Grok transcription + language analysis
    → Confidence scorer (audio + urgency / money / impersonation flags + vector match)
    → Twilio SMS by severity, always linking to the site
    → If scam-like: Grok cleans + categorizes → upsert scam record + embedding
```

**Signals we combine:** unknown caller, cash / money / “too good” offers, romance, urgency and pressure, rule flags, and **AI-generated audio**.

**Warning tiers (Twilio)**

| Confidence | Behavior |
| --- | --- |
| Low | Optional soft SMS |
| Medium | Clear warning + site link |
| High | Repeated texts; all copy points to the website |

Every warning states that a potential scam was flagged, gives a **specific reason** (e.g. synthetic voice score high; urgency + gift-card ask; close match to an “IRS refund” cluster), and sends people to look it up.

The website also ranks candidates from questionnaire answers (rules + embeddings + the scam database) and includes a **“This is what happened to me”** path into the corpus.

---

## Stack

| Layer | Choice |
| --- | --- |
| Website | React |
| Transcription + analysis | Grok |
| AI / synthetic voice detection | ElevenLabs |
| SMS warnings | Twilio |
| Similarity | Embeddings + vector search |
| Stretch | Chrome extension, Discord |

---

## Repo status (hackathon)

In progress. The first slice that is in this repo is the **ElevenLabs AI-audio track** — a backend the rest of the pipeline can call without waiting on telephony or the site.

| Path | Status |
| --- | --- |
| [`backend/ai_audio`](backend/ai_audio) | ElevenLabs synthetic-voice detector (`elevenlabs_ai_score`, `ai_voice_used`) |
| [`backend/db`](backend/db) | Postgres scam-pattern schema (SQLAlchemy + Alembic) |
| React questionnaire + scam pages | Planned |
| Grok clean / categorize + vector DB | Planned |
| Twilio severity warnings | Planned |
| Chrome / Discord | Stretch (P2) |

### Run the AI-audio detector

```bash
cd backend/ai_audio
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8001
```

```bash
curl -s -F "file=@sample.mp3" http://127.0.0.1:8001/v1/detect
```

Returns a 0–1 ElevenLabs score, `yes` / `no` / `unknown` for AI voice, a one-line `reason` suitable for SMS copy, and honest detector limits (ElevenLabs voices only; first ~minute; not a general anti-deepfake oracle). Details: [`backend/ai_audio/README.md`](backend/ai_audio/README.md).

---

## Prize tracks we are aiming at

| Track | Why this project |
| --- | --- |
| **ElevenLabs** | Real AI-voice detection on scam call audio, wired into a victim-facing product. |
| **GoDaddy** | Memorable public-good domain; the site is the destination every warning points to. |
| **Bloomberg Philanthropy** | Public repository of scam patterns; mid-interaction protection, not a dark-pattern ad tool. |
| **Cursor** | Built with Cursor. |

---

## Privacy

Personal information is stripped before anything is written into the public corpus. Call-recording consent and SMS opt-in are treated as real constraints, not afterthoughts.

---

HopHacks 2026. Built to help people recognize a scam in the moment — and to leave behind a living record of how those scams work.
