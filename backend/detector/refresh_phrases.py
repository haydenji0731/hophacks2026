#!/usr/bin/env python3
"""Refresh CLAP wake phrases from scam-pattern DB rows.

On ravens (detector cwd, DATABASE_URL in .env):

  uv run python refresh_phrases.py
  uv run python refresh_phrases.py --dry-run

Same work as POST /v1/phrases/refresh.
"""

from __future__ import annotations

import argparse
import json
import sys

from keywords import refresh_phrases


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Freeze CLAP phrases from Postgres into clap_phrases.json")
    parser.add_argument("--dry-run", action="store_true", help="Print JSON; do not write clap_phrases.json")
    args = parser.parse_args(argv)

    payload = refresh_phrases(dry_run=args.dry_run)
    print(json.dumps(payload, indent=2))
    if payload.get("warnings"):
        print("warnings:", "; ".join(payload["warnings"]), file=sys.stderr)
    return 0 if payload.get("phrases") else 1


if __name__ == "__main__":
    raise SystemExit(main())
