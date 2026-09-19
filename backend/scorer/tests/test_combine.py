from combine import (
    build_analyze_response,
    combine_confidence,
    map_ai_generated,
    notification_tier,
)
from schemas import GrokFlags
from settings import Settings


def test_map_ai_generated() -> None:
    assert map_ai_generated("yes") is True
    assert map_ai_generated("no") is False
    assert map_ai_generated("unknown") is None
    assert map_ai_generated(None) is None


def test_notification_tier() -> None:
    cfg = Settings()
    assert notification_tier(0.91, cfg) == "high"
    assert notification_tier(0.70, cfg) == "high"
    assert notification_tier(0.40, cfg) == "medium"
    assert notification_tier(0.39, cfg) == "low"


def test_combine_weights() -> None:
    cfg = Settings(audio_weight=0.4, language_weight=0.6)
    mixed = combine_confidence(audio_score=1.0, language_score=0.0, cfg=cfg)
    assert mixed == 0.4


def test_combine_single_source() -> None:
    assert combine_confidence(audio_score=0.8, language_score=None) == 0.8
    assert combine_confidence(audio_score=None, language_score=0.3) == 0.3


def test_build_reason_and_response() -> None:
    grok = GrokFlags(
        is_scam=True,
        scam_type="grandparent_impersonation",
        confidence=0.95,
        reasoning="Gift-card bail ask and secrecy from parents.",
    )
    result = build_analyze_response(
        audio_score=0.91,
        ai_voice_used="yes",
        grok=grok,
        warnings=[],
        cfg=Settings(audio_weight=0.4, language_weight=0.6),
    )
    assert result.ai_generated is True
    assert result.notification_tier == "high"
    assert result.scam_confidence == 0.4 * 0.91 + 0.6 * 0.95
    assert "ElevenLabs synthetic-voice score 0.91" in result.reason
    assert "grandparent_impersonation" in result.reason
