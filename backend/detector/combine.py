from __future__ import annotations

from schemas import AiVoiceUsed, AnalyzeResponse, GrokFlags, NotificationTier
from settings import Settings, settings


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def map_ai_generated(ai_voice_used: AiVoiceUsed | None) -> bool | None:
    if ai_voice_used == "yes":
        return True
    if ai_voice_used == "no":
        return False
    return None


def notification_tier(score: float, cfg: Settings | None = None) -> NotificationTier:
    cfg = cfg or settings
    if score >= cfg.high_threshold:
        return "high"
    if score >= cfg.medium_threshold:
        return "medium"
    return "low"


def combine_confidence(
    *,
    audio_score: float | None,
    language_score: float | None,
    cfg: Settings | None = None,
) -> float:
    cfg = cfg or settings
    if audio_score is None and language_score is None:
        raise ValueError("Need at least one of audio_score or language_score")
    if audio_score is None:
        return clamp(language_score or 0.0)
    if language_score is None:
        return clamp(audio_score)
    total_weight = cfg.audio_weight + cfg.language_weight
    if total_weight <= 0:
        raise ValueError("audio_weight and language_weight must sum to more than 0")
    mixed = (cfg.audio_weight * audio_score + cfg.language_weight * language_score) / total_weight
    return clamp(mixed)


def build_reason(
    *,
    audio_score: float | None,
    grok: GrokFlags | None,
) -> str:
    parts: list[str] = []
    if grok is not None:
        if grok.is_scam:
            parts.append(f"{grok.scam_type} (language {grok.confidence:.2f})")
        else:
            parts.append(f"language score {grok.confidence:.2f}: {grok.reasoning}")
    if audio_score is not None:
        parts.append(f"ElevenLabs synthetic-voice score {audio_score:.2f}")
    if grok is not None and grok.is_scam and grok.reasoning:
        parts.append(grok.reasoning)
    return "; ".join(parts) if parts else "No detection signals available"


def build_analyze_response(
    *,
    audio_score: float | None,
    ai_voice_used: AiVoiceUsed | None,
    grok: GrokFlags | None,
    warnings: list[str] | None = None,
    cfg: Settings | None = None,
) -> AnalyzeResponse:
    language_score = grok.confidence if grok is not None else None
    combined = combine_confidence(audio_score=audio_score, language_score=language_score, cfg=cfg)
    return AnalyzeResponse(
        elevenlabs_ai_score=audio_score,
        ai_voice_used=ai_voice_used,
        ai_generated=map_ai_generated(ai_voice_used),
        grok=grok,
        scam_confidence=combined,
        notification_tier=notification_tier(combined, cfg),
        reason=build_reason(audio_score=audio_score, grok=grok),
        warnings=list(warnings or []),
    )
