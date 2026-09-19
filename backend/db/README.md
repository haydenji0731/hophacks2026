# Scam pattern DB

SQLAlchemy 2 + Alembic schema for known scam **types** (one row per pattern).

## Setup

```bash
cd backend/db
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit DATABASE_URL (user, password, db name)
alembic upgrade head
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

## Useful commands

```bash
alembic current
alembic history
alembic downgrade -1
```
