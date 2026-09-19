# Scam pattern DB

SQLAlchemy 2 + Alembic schema for known scam **types** (one row per pattern).

## Setup

```bash
cd backend/db
uv sync --group dev
cp .env.example .env
# edit DATABASE_URL (user, password, db name)
uv run alembic upgrade head
```

## Schema (`scams`)

| Column | Meaning |
| --- | --- |
| `name` | Human label for the scam type |
| `platforms` | `phone` / `sms` / `web` / `discord` / `other` |
| `ai_generated` | Whether the interaction used AI (`NULL` = unknown) |
| `victim_roles` | Role/demographic tags only — no PII |
| `demands` | `cash`, `gift_card`, `wire`, `crypto`, `check`, `other` |
| `description` | Keywords/phrases (no personal info) |
| `frequency` | How often this pattern has been seen |

## Upsert helper

`repository.upsert_scam_from_detection(...)` creates or enriches a row from Grok detection fields (`scam_type`, `method`, `target`, `reasoning`). Never stores a raw transcript. Same `name` bumps `frequency`.

## Seed (Reddit patterns)

~96 scam types live in [`seeds/reddit_scam_patterns.tsv`](seeds/reddit_scam_patterns.tsv) (corpus for the site DB — **not** under `training_data/`, which is audio/transcript ML).

```bash
uv run python seed_reddit_patterns.py
# or from the T7 export:
uv run python seed_reddit_patterns.py --path /Volumes/T7/reddit_scam_patterns.062126_091926.tsv
```

## Useful commands

```bash
uv run alembic current
uv run alembic history
uv run alembic downgrade -1
uv run pytest -q
```
