from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    discord_bot_token: str = ""
    detector_url: str = "http://127.0.0.1:8000"
    site_url: str = "https://wehatescammers.com"
    request_timeout_seconds: float = 45.0


settings = Settings()
