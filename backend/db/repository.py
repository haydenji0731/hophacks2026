from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Demand, Platform, Scam

UpsertAction = Literal["created", "updated"]


def normalize_scam_name(scam_type: str | None) -> str | None:
    name = (scam_type or "").strip()
    if not name or name.lower() == "none":
        return None
    return name[:255]


def parse_demands_from_text(*texts: str) -> list[Demand]:
    blob = " ".join(t.lower() for t in texts if t)
    if not blob:
        return []

    rules: list[tuple[tuple[str, ...], Demand]] = [
        (("gift card", "giftcard", "google play", "itunes", "steam card"), Demand.gift_card),
        (("wire", "western union"), Demand.wire),
        (("crypto", "bitcoin", "btc", "usdt", " eth "), Demand.crypto),
        (("cheque", " check", "check ", "cashier"), Demand.check),
        (("cash", "moneygram", "money gram"), Demand.cash),
    ]
    found: list[Demand] = []
    for keys, demand in rules:
        if any(key in blob for key in keys):
            found.append(demand)
    return found


def victim_roles_from_target(target: str | None) -> list[str]:
    value = (target or "").strip()
    if not value or value.lower() in {"unclear", "none", "unknown", "n/a"}:
        return []
    return [value[:100]]


def build_description(*, reasoning: str | None, method: str | None) -> str:
    parts: list[str] = []
    method_clean = (method or "").strip()
    if method_clean and method_clean.lower() != "none":
        parts.append(method_clean)
    reasoning_clean = (reasoning or "").strip()
    if reasoning_clean:
        parts.append(reasoning_clean)
    return " | ".join(parts)[:4000]


def _merge_unique(existing: Sequence, new_items: Iterable) -> list:
    merged: list = list(existing or [])
    seen = {item for item in merged}
    for item in new_items:
        if item not in seen:
            merged.append(item)
            seen.add(item)
    return merged


def upsert_scam_from_detection(
    session: Session,
    *,
    scam_type: str,
    method: str = "none",
    target: str = "unclear",
    reasoning: str = "",
    ai_generated: bool | None = None,
    platform: Platform = Platform.phone,
) -> tuple[Scam, UpsertAction] | None:
    """
    Create or enrich a scam-pattern row from a detection result.

    Never stores a raw transcript — only cleaned labels / reasoning keywords.
    Returns None when scam_type is empty or 'none'.
    """
    name = normalize_scam_name(scam_type)
    if name is None:
        return None

    demands = parse_demands_from_text(method, scam_type, reasoning)
    roles = victim_roles_from_target(target)
    description = build_description(reasoning=reasoning, method=method)

    existing = session.scalar(select(Scam).where(Scam.name == name))
    if existing is None:
        scam = Scam(
            name=name,
            platforms=[platform],
            ai_generated=ai_generated,
            victim_roles=roles,
            demands=demands,
            description=description,
            frequency=1,
        )
        session.add(scam)
        session.commit()
        session.refresh(scam)
        return scam, "created"

    existing.frequency = int(existing.frequency or 0) + 1
    existing.platforms = _merge_unique(existing.platforms, [platform])
    existing.demands = _merge_unique(existing.demands, demands)
    existing.victim_roles = _merge_unique(existing.victim_roles, roles)
    if ai_generated is not None:
        existing.ai_generated = ai_generated
    if description and (not existing.description or len(description) >= len(existing.description)):
        existing.description = description
    session.commit()
    session.refresh(existing)
    return existing, "updated"
