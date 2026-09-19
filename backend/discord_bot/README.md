# Discord scam checker

P2 from the spec: same conversation-analysis path as phone/text, on Discord.

Members paste a suspicious DM or ping `!scam` / `/scamcheck`. The bot sends the text to [`backend/detector`](../detector) `POST /v1/analyze` (Grok flags; no audio) and replies with confidence, closest scam type, and a link to the site.

It does **not** send Textbelt SMS and does **not** store Discord usernames in Postgres.

## Setup (once)

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application.
2. Bot → Add Bot → reset token → copy into `.env` as `DISCORD_BOT_TOKEN`.
3. Bot → Privileged Gateway Intents → enable **Message Content Intent**.
4. OAuth2 → URL Generator → scopes `bot` + `applications.commands`. Permissions: Send Messages, Embed Links, Read Message History, Use Slash Commands.
5. Open the generated URL, invite the bot to your hackathon server.

## Run

Detector must already be up (`uvicorn` on port 8000) with `XAI_API_KEY` so Grok can score text.

```bash
cd backend/discord_bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# repo-root .env or backend/discord_bot/.env
# DISCORD_BOT_TOKEN=...
# DETECTOR_URL=http://127.0.0.1:8000
# SITE_URL=https://wehatescammers.com
python bot.py
```

## How to demo

| Action | Result |
| --- | --- |
| `/scamcheck message: Hi grandma I need gift cards, don't tell mom` | Embed with high-confidence family/gift-card style flags |
| Reply to a pasted scam with `!scam` | Same analysis of the original message |
| Harmless dentist reminder | “Doesn't look like a typical scam” |

Keep real account numbers and passwords out of the paste.

## Tests

```bash
cd backend/discord_bot
pytest
```
