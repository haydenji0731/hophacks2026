from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    elevenlabs_api_key: str | None = None
    elevenlabs_classifier_url: str = (
        "https://api.elevenlabs.io/v1/moderation/ai-speech-classification"
    )
    request_timeout_seconds: float = 30.0
    max_upload_bytes: int = 10 * 1024 * 1024
    yes_threshold: float = 0.70
    no_threshold: float = 0.30
    clip_seconds: float = 30.0


settings = Settings()
