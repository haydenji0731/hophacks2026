from types import SimpleNamespace

from keywords import (
    SCAM_WAKE_PHRASES,
    live_phrases,
    merge_phrase_books,
    payload_to_book,
    refresh_phrases,
    variants_for_scam,
)


def test_merge_phrase_books_db_wins_then_seed_fills() -> None:
    db = [("utility_disconnection", ("power shut off", "utility disconnection"))]
    merged = merge_phrase_books(db, SCAM_WAKE_PHRASES)
    labels = [label for label, _ in merged]
    assert labels[0] == "utility_disconnection"
    spoken = {variant for _label, variants in merged for variant in variants}
    assert "power shut off" in spoken
    assert "gift card" in spoken


def test_merge_skips_duplicate_spoken_strings() -> None:
    db = [("gift_cards", ("gift card", "gift cards"))]
    merged = merge_phrase_books(db, SCAM_WAKE_PHRASES)
    gift_labels = [label for label, variants in merged if "gift card" in variants]
    assert gift_labels == ["gift_cards"]


def test_variants_for_scam_are_short_and_unique() -> None:
    scam = SimpleNamespace(
        name="gift_card_bail",
        demands=[SimpleNamespace(value="gift_card")],
        description="gift card payment request | long unused rest",
    )
    variants = variants_for_scam(scam)
    assert "gift card bail" in variants
    assert "gift card" in variants
    assert len(variants) == len(set(variants))
    assert all(len(v) <= 48 for v in variants)


def test_refresh_phrases_writes_json(tmp_path, monkeypatch) -> None:
    path = tmp_path / "clap_phrases.json"
    monkeypatch.setattr("keywords._phrase_path", lambda: path)
    monkeypatch.setattr(
        "keywords._fetch_db_phrase_book",
        lambda limit=48: [("tech_support", ("team viewer", "remote access"))],
    )
    payload = refresh_phrases()
    assert path.is_file()
    assert payload["source_count"] == 1
    book = payload_to_book(payload)
    labels = [label for label, _ in book]
    assert labels[0] == "tech_support"
    live = live_phrases()
    assert live["phrases"][0]["label"] == "tech_support"
