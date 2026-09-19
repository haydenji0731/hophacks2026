from __future__ import annotations

from combine import build_analyze_response
from grok import GrokError, run_grok_flags
from paths import ensure_import_paths
from schemas import AnalyzeResponse, GrokFlags
from settings import settings


def classify_call_audio(file_bytes: bytes, filename: str, content_type: str):
    ensure_import_paths()
    from classifier import ClassifierError, classify_audio

    try:
        return classify_audio(file_bytes, filename, content_type)
    except ClassifierError:
        raise


def analyze_incident(
    *,
    transcript: str | None,
    audio: tuple[bytes, str, str] | None,
) -> AnalyzeResponse:
    warnings: list[str] = []
    audio_score = None
    ai_voice_used = None
    grok: GrokFlags | None = None

    if audio is not None:
        file_bytes, filename, content_type = audio
        try:
            detected = classify_call_audio(file_bytes, filename, content_type)
            audio_score = detected.elevenlabs_ai_score
            ai_voice_used = detected.ai_voice_used
        except Exception as exc:
            warnings.append(f"ElevenLabs audio detection unavailable: {exc}")

    if transcript:
        try:
            grok = run_grok_flags(transcript)
        except GrokError as exc:
            warnings.append(f"Grok language detection unavailable: {exc.message}")

    if audio_score is None and grok is None:
        raise ValueError("No usable signals: provide a transcript and/or audio, and at least one detector must succeed")

    return build_analyze_response(
        audio_score=audio_score,
        ai_voice_used=ai_voice_used,
        grok=grok,
        warnings=warnings,
        cfg=settings,
    )
