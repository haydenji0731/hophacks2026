"""Load scam-pattern TSV/CSV into the scams table (upsert on name).

Works for any seed export that shares the scams columns:
  id, name, platforms, ai_generated, victim_roles, demands,
  description, frequency, created_at, updated_at

Examples:
  cd backend/db
  uv sync --group dev
  uv run python seed_scam_patterns.py --path seeds/reddit_scam_patterns.062126_091926.tsv
  uv run python seed_scam_patterns.py --path seeds/scams_patterns_multisource.091926.tsv
"""

from __future__ import annotations

import argparse
import csv
import re
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from models import Demand, Platform, Scam
from session import get_session_factory


# Postgres-ish array cell: {a,b} or {"a b","c"} or mixed.
_ARRAY_ITEM = re.compile(
    r'"((?:[^"\\]|\\.)*)"|([^,\{\}]+)'
)


def parse_pg_text_array(raw: str | None) -> list[str]:
    if raw is None:
        return []
    text = raw.strip()
    if not text or text == "{}":
        return []
    if text.startswith("{") and text.endswith("}"):
        text = text[1:-1]
    if not text.strip():
        return []

    items: list[str] = []
    for match in _ARRAY_ITEM.finditer(text):
        quoted, bare = match.groups()
        value = quoted if quoted is not None else bare
        value = value.strip().strip('"')
        if value:
            items.append(value)
    return items


def parse_ai_generated(raw: str | None) -> bool | None:
    if raw is None:
        return None
    value = raw.strip().lower()
    if not value:
        return None
    if value in {"t", "true", "1", "yes", "y"}:
        return True
    if value in {"f", "false", "0", "no", "n"}:
        return False
    return None


def parse_platforms(raw: str | None) -> list[Platform]:
    out: list[Platform] = []
    for item in parse_pg_text_array(raw):
        key = item.strip().lower()
        try:
            out.append(Platform(key))
        except ValueError:
            out.append(Platform.other)
    return out


def parse_demands(raw: str | None) -> list[Demand]:
    out: list[Demand] = []
    for item in parse_pg_text_array(raw):
        key = item.strip().lower()
        try:
            out.append(Demand(key))
        except ValueError:
            out.append(Demand.other)
    return out


def parse_timestamp(raw: str | None) -> datetime | None:
    if not raw or not raw.strip():
        return None
    text = raw.strip().replace("Z", "+00:00")
    return datetime.fromisoformat(text)


def load_rows(path: Path) -> list[dict]:
    delimiter = "," if path.suffix.lower() == ".csv" else "\t"
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle, delimiter=delimiter)
        return list(reader)


def upsert_row(session, row: dict) -> str:
    name = (row.get("name") or "").strip()
    if not name:
        return "skipped"

    platforms = parse_platforms(row.get("platforms"))
    demands = parse_demands(row.get("demands"))
    victim_roles = parse_pg_text_array(row.get("victim_roles"))
    description = (row.get("description") or "").strip()
    frequency = int(row.get("frequency") or 0)
    ai_generated = parse_ai_generated(row.get("ai_generated"))
    created_at = parse_timestamp(row.get("created_at"))
    updated_at = parse_timestamp(row.get("updated_at"))

    raw_id = (row.get("id") or "").strip()
    scam_id = uuid.UUID(raw_id) if raw_id else uuid.uuid4()

    existing = session.scalar(select(Scam).where(Scam.name == name))
    if existing is None:
        scam = Scam(
            id=scam_id,
            name=name,
            platforms=platforms,
            ai_generated=ai_generated,
            victim_roles=victim_roles,
            demands=demands,
            description=description,
            frequency=frequency,
        )
        if created_at is not None:
            scam.created_at = created_at
        if updated_at is not None:
            scam.updated_at = updated_at
        session.add(scam)
        return "created"

    existing.platforms = platforms
    existing.demands = demands
    existing.victim_roles = victim_roles
    existing.description = description
    existing.frequency = frequency
    existing.ai_generated = ai_generated
    if updated_at is not None:
        existing.updated_at = updated_at
    return "updated"


def seed(path: Path) -> dict[str, int]:
    rows = load_rows(path)
    counts = {"created": 0, "updated": 0, "skipped": 0}
    session = get_session_factory()()
    try:
        for row in rows:
            action = upsert_row(session, row)
            counts[action] = counts.get(action, 0) + 1
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
    return counts


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Seed scams table from a pattern TSV/CSV (upsert on name)"
    )
    parser.add_argument(
        "--path",
        type=Path,
        required=True,
        help="Path to seed file (TSV or CSV)",
    )
    args = parser.parse_args(argv)
    path = args.path
    if not path.is_file():
        raise SystemExit(f"Seed file not found: {path}")

    counts = seed(path)
    total = sum(counts.values())
    print(f"Seeded from {path}")
    print(
        f"rows={total} created={counts['created']} "
        f"updated={counts['updated']} skipped={counts['skipped']}"
    )


if __name__ == "__main__":
    main()
