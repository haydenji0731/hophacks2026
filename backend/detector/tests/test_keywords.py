from types import SimpleNamespace

from keywords import (
    SCAM_WAKE_PHRASES,
    live_phrases,
    load_wake_phrases,
    merge_phrase_books,
    payload_to_book,
    refresh_phrases,
    variants_for_scam,
)


def test_merge_phrase_books_first_book_wins_then_later_fills() -> None:
    db = [("utility_disconnection", ("power shut off", "utility disconnection"))]
    merged = merge_phrase_books(SCAM_WAKE_PHRASES, db)
    labels = [label for label, _ in merged]
    assert labels[0] == "gift_card"
    spoken = {variant for _label, variants in merged for variant in variants}
    assert "power shut off" in spoken
    assert "gift card" in spoken


def test_merge_skips_duplicate_spoken_strings() -> None:
    db = [("gift_cards", ("gift card", "gift cards"))]
    merged = merge_phrase_books(SCAM_WAKE_PHRASES, db)
    gift_labels = [label for label, variants in merged if "gift card" in variants]
    assert gift_labels == ["gift_card"]


def test_variants_for_scam_are_spoken_not_slugs() -> None:
    scam = SimpleNamespace(
        name="gift_card_bail",
        demands=[
            SimpleNamespace(value="gift_card"),
            SimpleNamespace(value="other"),
            SimpleNamespace(value="cash"),
        ],
        description="gift card payment request | long unused rest",
    )
    variants = variants_for_scam(scam)
    assert "gift card bail" not in variants
    assert "other" not in variants
    assert "cash" not in variants
    assert "gift card" in variants
    assert "gift cards" in variants
    assert "gift card payment request" in variants
    assert len(variants) == len(set(variants))
    assert all(len(v) <= 48 for v in variants)


def test_refresh_phrases_writes_json_and_clap_reads_it(tmp_path, monkeypatch) -> None:
    path = tmp_path / "clap_phrases.json"
    monkeypatch.setattr("keywords._phrase_path", lambda: path)
    monkeypatch.setattr(
        "keywords._fetch_db_phrase_book",
        lambda limit=48: [("crypto_romance", ("send bitcoin", "binance wallet"))],
    )
    payload = refresh_phrases()
    assert path.is_file()
    assert payload["source_count"] == 1
    book = payload_to_book(payload)
    labels = [label for label, _ in book]
    assert labels[0] == "gift_card"
    assert "crypto_romance" in labels
    live = live_phrases()
    assert live["phrases"][0]["label"] == "gift_card"
    assert any(row["label"] == "crypto_romance" for row in live["phrases"])
    assert load_wake_phrases(force=True)[0][0] == "gift_card"
    spoken = {variant for _label, variants in load_wake_phrases(force=True) for variant in variants}
    assert "send bitcoin" in spoken
    assert "gift card" in spoken
