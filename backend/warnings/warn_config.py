from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Twilio credentials. When any of these is missing the notifier runs in
    # dry-run mode: it builds the exact SMS copy but does not hit Twilio. This
    # keeps the demo working without live SMS or opt-in, which the spec calls
    # out as a real constraint.
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None

    request_timeout_seconds: float = 15.0

    # The destination every warning points to.
    site_url: str = "https://wehatescammers.com"

    # How many messages each tier sends. High is "repeated texts" per spec.
    low_repeat_count: int = 1
    medium_repeat_count: int = 1
    high_repeat_count: int = 3

    # Low tier is "optional" in the spec. Off by default so we do not spam on
    # weak signals; flip to true to send the soft single SMS.
    send_low_tier: bool = False


settings = Settings()
