from __future__ import annotations

from repository import (
    build_description,
    normalize_scam_name,
    parse_demands_from_text,
    victim_roles_from_target,
)
from models import Demand


def test_normalize_scam_name() -> None:
    assert normalize_scam_name("  IRS refund  ") == "IRS refund"
    assert normalize_scam_name("none") is None
    assert normalize_scam_name("") is None


def test_parse_demands_gift_card() -> None:
    demands = parse_demands_from_text("gift card payment request", "grandparent_impersonation")
    assert Demand.gift_card in demands


def test_victim_roles_from_target() -> None:
    assert victim_roles_from_target("elderly individual") == ["elderly individual"]
    assert victim_roles_from_target("unclear") == []


def test_build_description_excludes_none_method() -> None:
    assert build_description(reasoning="Urgency + secrecy.", method="none") == "Urgency + secrecy."
    assert "gift card" in build_description(
        reasoning="Asked for codes.",
        method="gift card payment request",
    )
