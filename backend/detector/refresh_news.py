#!/usr/bin/env python3
"""Refresh home-page news cards from recent scam-pattern DB rows + Grok.

On ravens (detector cwd, DATABASE_URL + XAI_API_KEY in .env):

  uv run python refresh_news.py
  uv run python refresh_news.py --days 7 --dry-run

Same work as POST /v1/news/refresh.
"""

from __future__ import annotations

import argparse
import json
import sys

from news_wire import refresh_wire


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Flip the news wire from recent DB scams")
    parser.add_argument("--days", type=int, default=None, help="Lookback window (default NEWS_LOOKBACK_DAYS / 14)")
    parser.add_argument("--dry-run", action="store_true", help="Print JSON; do not write news_wire.json")
    args = parser.parse_args(argv)

    payload = refresh_wire(days=args.days, dry_run=args.dry_run)
    print(json.dumps(payload, indent=2))
    if payload.get("warnings"):
        print("warnings:", "; ".join(payload["warnings"]), file=sys.stderr)
    return 0 if payload.get("articles") else 1


if __name__ == "__main__":
    raise SystemExit(main())
