from types import SimpleNamespace

import pytest

from grok import GrokError
from news_wire import (
    align_cards,
    fallback_cards,
    live_cards,
    mix_feed_rows,
    parse_articles,
    refresh_wire,
    serialize_scam,
)
from settings import settings


def test_serialize_scam_flattens_enums() -> None:
    row = SimpleNamespace(
        id="abc",
        name="Utility disconnect",
        frequency=4,
        platforms=[SimpleNamespace(value="phone")],
        demands=[SimpleNamespace(value="gift_card")],
        ai_generated=True,
        description="Past due, then gift cards.",
        updated_at=None,
    )
    out = serialize_scam(row)
    assert out["name"] == "Utility disconnect"
    assert out["platforms"] == ["phone"]
    assert out["demands"] == ["gift_card"]
    assert out["ai_generated"] is True


def test_fallback_cards_mark_first_three_featured() -> None:
    rows = [
        {"name": f"Pattern {i}", "demands": ["gift_card"], "date": "2026-09-19"}
        for i in range(5)
    ]
    cards = fallback_cards(rows)
    assert len(cards) == 5
    assert [c["featured"] for c in cards] == [True, True, True, False, False]
    assert "gift_card" in cards[0]["dek"]
    assert cards[0]["href"] == "/scams"


def test_parse_articles_caps_featured_and_fills_missing() -> None:
    fallback = fallback_cards([{"name": "Keep me", "demands": [], "date": "2026-09-01"}])
    parsed = parse_articles(
        {
            "articles": [
                {
                    "id": "a",
                    "title": "A",
                    "dek": "Dek A",
                    "featured": True,
                    "href": "/scams",
                },
                {
                    "id": "b",
                    "title": "B",
                    "dek": "Dek B",
                    "featured": True,
                },
                {
                    "id": "c",
                    "title": "C",
                    "dek": "Dek C",
                    "featured": True,
                },
                {
                    "id": "d",
                    "title": "D",
                    "dek": "Dek D",
                    "featured": True,
                },
            ]
        },
        fallback=fallback,
    )
    assert len(parsed) == 4
    assert sum(1 for a in parsed if a["featured"]) == 3
    assert parsed[3]["featured"] is False
    assert parsed[1]["href"] == "/scams"


def test_align_cards_keeps_newest_row_if_grok_skips_it() -> None:
    rows = [
        {"name": "microsoft_teams_vishing_meeting", "demands": ["wire"], "date": "2026-09-19"},
        {"name": "facebook_marketplace_payment_scam", "demands": ["cash"], "date": "2026-09-18"},
        {"name": "job_offer_training_equipment_fee", "demands": ["wire"], "date": "2026-09-18"},
    ]
    grok_only_old = [
        {
            "id": "facebook-marketplace-payment-scam",
            "title": "Facebook Marketplace trap",
            "dek": "Off-platform pay.",
            "href": "/scams",
            "source": "WeHateScammers",
            "date": "2026-09-19",
            "featured": True,
        }
    ]
    cards = align_cards(rows, grok_only_old)
    assert [c["id"] for c in cards] == [
        "microsoft-teams-vishing-meeting",
        "facebook-marketplace-payment-scam",
        "job-offer-training-equipment-fee",
    ]
    assert cards[0]["featured"] is True
    assert cards[0]["tag"] == "new"
    assert cards[1]["tag"] == "hot"
    assert "microsoft_teams_vishing_meeting" in cards[0]["dek"]
    assert cards[1]["title"] == "Facebook Marketplace trap"


def test_mix_feed_rows_one_new_two_hot() -> None:
    rows = [
        {"name": "newest", "frequency": 1, "date": "2026-09-19"},
        {"name": "quiet", "frequency": 2, "date": "2026-09-18"},
        {"name": "hot-a", "frequency": 9, "date": "2026-09-17"},
        {"name": "hot-b", "frequency": 8, "date": "2026-09-16"},
        {"name": "also", "frequency": 3, "date": "2026-09-15"},
    ]
    tagged = mix_feed_rows(rows)
    assert [tag for tag, _ in tagged[:3]] == ["new", "hot", "hot"]
    assert [row["name"] for _, row in tagged[:3]] == ["newest", "hot-a", "hot-b"]
    assert tagged[3][0] is None
    assert tagged[3][1]["name"] == "quiet"


def test_live_cards_orders_newest_first(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "news_wire.fetch_recent_rows",
        lambda **_k: [
            {"name": "microsoft_teams_vishing_meeting", "demands": ["wire"], "date": "2026-09-19"},
            {"name": "facebook_marketplace_payment_scam", "demands": ["cash"], "date": "2026-09-18"},
        ],
    )
    monkeypatch.setattr(
        "news_wire.load_wire",
        lambda: {
            "articles": [
                {
                    "id": "facebook-marketplace-payment-scam",
                    "title": "Facebook Marketplace trap",
                    "dek": "Off-platform pay.",
                    "href": "/scams",
                    "source": "WeHateScammers",
                    "date": "2026-09-18",
                    "featured": True,
                }
            ]
        },
    )
    payload = live_cards(days=14)
    assert payload["articles"][0]["id"] == "microsoft-teams-vishing-meeting"
    assert payload["articles"][0]["tag"] == "new"
    assert payload["articles"][0]["featured"] is True
    assert payload["articles"][1]["title"] == "Facebook Marketplace trap"
    assert payload["articles"][1]["tag"] == "hot"
    assert payload["source_count"] == 2


def test_parse_articles_empty_uses_fallback() -> None:
    fallback = [{"id": "x", "title": "X", "dek": "Y"}]
    assert parse_articles({"articles": []}, fallback=fallback) == fallback
    assert parse_articles("nope", fallback=fallback) == fallback


def test_refresh_wire_uses_grok_and_writes(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "news_wire_path", str(tmp_path / "news_wire.json"))
    monkeypatch.setattr(
        "news_wire.fetch_recent_rows",
        lambda **_k: [
            {
                "name": "IRS impersonation",
                "demands": ["gift_card"],
                "date": "2026-09-18",
            }
        ],
    )
    monkeypatch.setattr(
        "news_wire.grok_news_cards",
        lambda _rows: [
            {
                "id": "irs",
                "source": "WeHateScammers",
                "date": "2026-09-19",
                "title": "IRS gift-card rush",
                "dek": "Callers claim a refund then demand gift cards.",
                "href": "/scams",
                "featured": True,
            }
        ],
    )
    payload = refresh_wire(days=7)
    assert payload["lookback_days"] == 7
    assert payload["articles"][0]["title"] == "IRS gift-card rush"
    assert (tmp_path / "news_wire.json").is_file()
    assert payload["source_count"] == 1


def test_refresh_wire_falls_back_when_grok_fails(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "news_wire_path", str(tmp_path / "news_wire.json"))
    monkeypatch.setattr(
        "news_wire.fetch_recent_rows",
        lambda **_k: [{"name": "Bail scam", "demands": ["wire"], "date": "2026-09-19"}],
    )

    def boom(_rows):
        raise GrokError("quota")

    monkeypatch.setattr("news_wire.grok_news_cards", boom)
    payload = refresh_wire()
    assert payload["articles"][0]["title"] == "Bail scam"
    assert any("Grok unavailable" in w for w in payload["warnings"])


def test_refresh_wire_keeps_existing_when_no_rows(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    wire = tmp_path / "news_wire.json"
    monkeypatch.setattr(settings, "news_wire_path", str(wire))
    wire.write_text(
        '{"updated_at":"2026-09-01T00:00:00+00:00","articles":[{"id":"old","title":"Old","dek":"Keep","href":"/scams","source":"WeHateScammers","date":"2026-09-01","featured":true}]}'
    )
    monkeypatch.setattr("news_wire.fetch_recent_rows", lambda **_k: [])
    payload = refresh_wire(days=14)
    assert payload["articles"][0]["title"] == "Old"
    assert any("kept existing" in w for w in payload["warnings"])


def test_refresh_wire_dry_run_does_not_write(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "news_wire.json"
    monkeypatch.setattr(settings, "news_wire_path", str(path))
    monkeypatch.setattr(
        "news_wire.fetch_recent_rows",
        lambda **_k: [{"name": "Prize", "demands": ["crypto"], "date": "2026-09-19"}],
    )
    monkeypatch.setattr("news_wire.grok_news_cards", lambda rows: fallback_cards(rows))
    payload = refresh_wire(dry_run=True)
    assert payload["articles"]
    assert not path.exists()
