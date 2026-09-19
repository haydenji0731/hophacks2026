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
            "ai_generated": "unknown",
        }
    )
    assert flags.is_scam is True
    assert flags.scam_type == "grandparent_impersonation"
    assert flags.confidence == pytest.approx(0.94)
    assert flags.method == "gift card payment request"
    assert flags.target == "elderly individual"
    assert flags.ai_generated is None


def test_parse_grok_payload_ai_generated_bool() -> None:
    yes = parse_grok_payload(
        {
            "is_scam": True,
            "scam_type": "irs",
            "confidence": 0.8,
            "reasoning": "x",
            "ai_generated": True,
        }
    )
    no = parse_grok_payload(
        {
            "is_scam": False,
            "scam_type": "none",
            "confidence": 0.1,
            "reasoning": "x",
            "ai_generated": "no",
        }
    )
    assert yes.ai_generated is True
    assert no.ai_generated is False


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
    assert flags.ai_generated is None


def test_parse_grok_payload_rejects_non_object() -> None:
    with pytest.raises(GrokError):
        parse_grok_payload("not-json-object")
