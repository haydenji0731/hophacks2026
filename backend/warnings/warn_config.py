from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Textbelt key. Missing/blank → dry-run (copy is built, nothing is sent).
    # Use `textbelt` for the free quota (1 SMS/day). Paid keys send custom copy.
    textbelt_key: str | None = None

    request_timeout_seconds: float = 15.0

    # The destination every warning points to.
    site_url: str = "https://wehatescammers.com"

    # How many messages each tier sends. High is "repeated texts" per spec.
    # The free Textbelt key is capped at 1 send regardless.
    low_repeat_count: int = 1
    medium_repeat_count: int = 1
    high_repeat_count: int = 3

    # Low tier is "optional" in the spec. Off by default so we do not spam on
    # weak signals; flip to true to send the soft single SMS.
    send_low_tier: bool = False


settings = Settings()
