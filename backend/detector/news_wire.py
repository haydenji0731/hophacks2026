from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from grok import GrokError
from settings import settings

API_URL = "https://api.x.ai/v1/chat/completions"
WIRE_PATH = Path(__file__).resolve().parent / "news_wire.json"

NEWS_SYSTEM_PROMPT = """You write home-page "wire" cards for WeHateScammers.
You will be given recent scam-pattern rows from our detector database (last 7–14 days).
The dek (blurb) must be inspired by those rows — names, demands, platforms, descriptions —
not a generic FTC reprint.

Respond with ONLY a valid JSON object, no markdown:
{
  "articles": [
    {
      "id": "kebab-slug",
      "source": "WeHateScammers",
      "date": "YYYY-MM-DD",
      "title": "short headline",
      "dek": "one or two sentences. Consumer-alert voice. What they claim, what they ask for, what to do. No URLs.",
      "href": "/scams",
      "featured": true
    }
  ]
}

Rules:
- At most 8 articles. Mark the 3 hottest featured=true (highest frequency).
- href is always "/scams" unless you have a real public URL for that pattern.
- Today's date unless the row is older; then use that row's date.
- No PII. No markdown.
"""


def wire_path() -> Path:
    override = (settings.news_wire_path or "").strip()
    return Path(override) if override else WIRE_PATH


def load_wire() -> dict[str, Any]:
    path = wire_path()
    if not path.is_file():
        return {"updated_at": None, "lookback_days": None, "articles": []}
    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return {"updated_at": None, "lookback_days": None, "articles": []}
    if not isinstance(payload, dict):
        return {"updated_at": None, "lookback_days": None, "articles": []}
    articles = [a for a in (payload.get("articles") or []) if isinstance(a, dict) and a.get("title")]
    return {
        "updated_at": payload.get("updated_at"),
        "lookback_days": payload.get("lookback_days"),
        "articles": articles,
    }


def save_wire(payload: dict[str, Any]) -> None:
    path = wire_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")


def _slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return (slug or "pattern")[:80]


def serialize_scam(row: Any) -> dict[str, Any]:
    updated = getattr(row, "updated_at", None)
    if isinstance(updated, datetime):
        updated_s = updated.astimezone(timezone.utc).date().isoformat()
    else:
        updated_s = date.today().isoformat()
    platforms = [getattr(p, "value", str(p)) for p in (getattr(row, "platforms", None) or [])]
    demands = [getattr(d, "value", str(d)) for d in (getattr(row, "demands", None) or [])]
    return {
        "id": str(getattr(row, "id", "")),
        "name": str(getattr(row, "name", "")),
        "frequency": int(getattr(row, "frequency", 0) or 0),
        "platforms": platforms,
        "demands": demands,
        "ai_generated": getattr(row, "ai_generated", None),
        "description": str(getattr(row, "description", "") or "")[:800],
        "date": updated_s,
    }


def fallback_cards(rows: list[dict[str, Any]], *, featured: int = 3) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    for i, row in enumerate(rows[:8]):
        name = row.get("name") or "Unknown pattern"
        demands = row.get("demands") or []
        ask = ", ".join(demands) if demands else "money or codes"
        dek = (
            f"Recent detections match {name}. Callers push for {ask}. "
            "Hang up and look the pattern up before you pay."
        )
        cards.append(
            {
                "id": _slug(name),
                "source": "WeHateScammers",
                "date": row.get("date") or date.today().isoformat(),
                "title": name,
                "dek": dek,
                "href": "/scams",
                "featured": i < featured,
            }
        )
    return cards


def parse_articles(payload: Any, *, fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return fallback
    raw = payload.get("articles")
    if not isinstance(raw, list) or not raw:
        return fallback
    articles: list[dict[str, Any]] = []
    featured_left = 3
    for item in raw[:8]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        dek = str(item.get("dek") or "").strip()
        if not title or not dek:
            continue
        featured = bool(item.get("featured"))
        if featured:
            if featured_left <= 0:
                featured = False
            else:
                featured_left -= 1
        href = str(item.get("href") or "/scams").strip() or "/scams"
        articles.append(
            {
                "id": str(item.get("id") or _slug(title))[:80],
                "source": str(item.get("source") or "WeHateScammers")[:80],
                "date": str(item.get("date") or date.today().isoformat())[:10],
                "title": title[:180],
                "dek": dek[:400],
                "href": href[:300],
                "featured": featured,
            }
        )
    if not any(a["featured"] for a in articles):
        for i, article in enumerate(articles[:3]):
            article["featured"] = True
    return articles or fallback


def fetch_recent_rows(*, days: int, limit: int = 20) -> list[dict[str, Any]]:
    from paths import DB, prefer_package

    prefer_package(DB, drop_modules=("models", "session", "repository", "db_config"))
    from repository import list_recent_scams
    from session import get_session_factory

    session = get_session_factory()()
    try:
        rows = list_recent_scams(session, days=days, limit=limit)
    finally:
        session.close()
    return [serialize_scam(row) for row in rows]


def grok_news_cards(rows: list[dict[str, Any]], *, api_key: str | None = None) -> list[dict[str, Any]]:
    fallback = fallback_cards(rows)
    key = (api_key or settings.xai_api_key or "").strip()
    if not key:
        raise GrokError("XAI_API_KEY is not set")
    model = (settings.xai_grok_model or "grok-4").strip()
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": NEWS_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps({"today": date.today().isoformat(), "patterns": rows}),
            },
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.3,
    }
    try:
        resp = httpx.post(
            API_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
            timeout=45.0,
        )
    except httpx.HTTPError as exc:
        raise GrokError(f"Grok news request failed: {exc}") from exc
    if resp.status_code >= 400:
        raise GrokError(f"Grok HTTP {resp.status_code}: {(resp.text or '')[:400]}")
    try:
        content = resp.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise GrokError("Grok news payload was not JSON") from exc
    return parse_articles(parsed, fallback=fallback)


def refresh_wire(*, days: int | None = None, dry_run: bool = False) -> dict[str, Any]:
    lookback = days if days is not None else settings.news_lookback_days
    warnings: list[str] = []
    try:
        rows = fetch_recent_rows(days=lookback)
    except Exception as exc:
        warnings.append(f"Database unavailable: {exc}")
        rows = []

    if not rows:
        existing = load_wire()
        if existing["articles"]:
            warnings.append(f"No scams updated in the last {lookback} days; kept existing wire.")
            existing["warnings"] = warnings
            return existing
        warnings.append(f"No scams updated in the last {lookback} days.")
        empty = {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "lookback_days": lookback,
            "articles": [],
            "warnings": warnings,
        }
        return empty

    try:
        articles = grok_news_cards(rows)
    except GrokError as exc:
        warnings.append(f"Grok unavailable, used template deks: {exc.message}")
        articles = fallback_cards(rows)

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "lookback_days": lookback,
        "articles": articles,
        "warnings": warnings,
        "source_count": len(rows),
    }
    if not dry_run:
        save_wire(payload)
    return payload
