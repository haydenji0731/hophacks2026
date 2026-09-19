from seed_scam_patterns import (
    parse_ai_generated,
    parse_demands,
    parse_pg_text_array,
    parse_platforms,
)
from models import Demand, Platform


def test_parse_pg_text_array_quoted_and_bare() -> None:
    assert parse_pg_text_array("{web,other}") == ["web", "other"]
    assert parse_pg_text_array('{"marketplace buyer","marketplace seller"}') == [
        "marketplace buyer",
        "marketplace seller",
    ]
    assert parse_pg_text_array('{renter,"housing seeker"}') == ["renter", "housing seeker"]
    assert parse_pg_text_array('{investor,"dating app user"}') == [
        "investor",
        "dating app user",
    ]
    assert parse_pg_text_array("{driver}") == ["driver"]
    assert parse_pg_text_array("") == []
    assert parse_pg_text_array("{}") == []


def test_parse_ai_generated_blank_is_none() -> None:
    assert parse_ai_generated("") is None
    assert parse_ai_generated("   ") is None
    assert parse_ai_generated("true") is True
    assert parse_ai_generated("false") is False


def test_parse_enums() -> None:
    assert parse_platforms("{phone,web,discord}") == [
        Platform.phone,
        Platform.web,
        Platform.discord,
    ]
    assert parse_demands("{gift_card,wire,crypto}") == [
        Demand.gift_card,
        Demand.wire,
        Demand.crypto,
    ]
