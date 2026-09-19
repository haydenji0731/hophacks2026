"""Deprecated alias — use seed_scam_patterns.py.

Kept so older docs/commands keep working:
  uv run python seed_reddit_patterns.py --path seeds/...
"""

from seed_scam_patterns import main

if __name__ == "__main__":
    main()
