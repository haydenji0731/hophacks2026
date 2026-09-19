from types import SimpleNamespace

import pytest

from grok import GrokError
from news_wire import fallback_cards, parse_articles, refresh_wire, serialize_scam
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
