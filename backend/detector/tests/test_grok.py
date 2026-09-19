from grok import GrokError, parse_grok_payload
import pytest


def test_parse_grok_payload_passes_method_and_target() -> None:
    flags = parse_grok_payload(
        {
            "is_scam": True,
            "scam_type": "grandparent_impersonation",
            "confidence": 0.94,
            "reasoning": "Gift-card bail ask and secrecy.",
            "method": "gift card payment request",
            "target": "elderly individual",
        }
    )
    assert flags.is_scam is True
    assert flags.scam_type == "grandparent_impersonation"
    assert flags.confidence == pytest.approx(0.94)
    assert flags.method == "gift card payment request"
    assert flags.target == "elderly individual"


def test_parse_grok_payload_defaults_missing_method_target() -> None:
    flags = parse_grok_payload(
        {
            "is_scam": False,
            "scam_type": "none",
            "confidence": 0.1,
            "reasoning": "Routine appointment reminder.",
        }
    )
    assert flags.method == "none"
    assert flags.target == "unclear"


def test_parse_grok_payload_rejects_non_object() -> None:
    with pytest.raises(GrokError):
        parse_grok_payload("not-json-object")


def test_parse_grok_ignores_legacy_ai_generated_field() -> None:
    flags = parse_grok_payload(
        {
            "is_scam": True,
            "scam_type": "irs",
            "confidence": 0.8,
            "reasoning": "x",
            "ai_generated": True,
        }
    )
    assert not hasattr(flags, "ai_generated") or "ai_generated" not in flags.model_fields_set
