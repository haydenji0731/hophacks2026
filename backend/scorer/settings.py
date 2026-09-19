from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    xai_api_key: str | None = None
    audio_weight: float = 0.4
    language_weight: float = 0.6
    high_threshold: float = 0.70
    medium_threshold: float = 0.40
    max_upload_bytes: int = 10 * 1024 * 1024


settings = Settings()
