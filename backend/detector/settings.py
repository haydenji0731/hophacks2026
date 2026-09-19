from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    xai_api_key: str | None = None
    audio_weight: float = 0.4
    language_weight: float = 0.6
    high_threshold: float = 0.70
    medium_threshold: float = 0.40
    max_upload_bytes: int = 10 * 1024 * 1024

    # Screen → escalate (dumb v1; replaceable with a statistical model later)
    ai_escalate_threshold: float = 0.50
    min_keyword_hits_to_escalate: int = 1

    # Grok STT
    stt_url: str = "https://api.x.ai/v1/stt"
    stt_model: str = "grok-voice-transcribe-2.0"
    stt_timeout_seconds: float = 180.0


settings = Settings()
