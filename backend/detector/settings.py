from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT_ENV, ".env"),
        extra="ignore",
    )

    xai_api_key: str | None = None
    audio_weight: float = 0.4
    language_weight: float = 0.6
    high_threshold: float = 0.70
    medium_threshold: float = 0.40
    max_upload_bytes: int = 10 * 1024 * 1024

    # Screen → escalate (dumb v1; replaceable with a statistical model later)
    ai_escalate_threshold: float = 0.50
    min_keyword_hits_to_escalate: int = 1
    clap_threshold: float = 0.30
    clap_model: str = "laion/clap-htsat-unfused"
    clap_phrases_path: str | None = None



    # Grok STT
    stt_url: str = "https://api.x.ai/v1/stt"
    stt_model: str = "grok-voice-transcribe-2.0"
    stt_timeout_seconds: float = 180.0

    xai_grok_model: str = "grok-4"

    news_lookback_days: int = 14
    news_refresh_secret: str | None = None
    news_wire_path: str | None = None


settings = Settings()
