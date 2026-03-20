# ABOUTME: Application configuration via environment variables using pydantic-settings.
# ABOUTME: Provides a cached singleton for consistent config access across modules.

from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    google_api_key: str = Field(validation_alias=AliasChoices("GOOGLE_API_KEY", "GEMINI_API_KEY"))
    gemini_model: str = Field(default="gemini-2.0-flash", alias="GEMINI_MODEL")

    allowed_models: list[str] = [
        "gemini-2.0-flash",
        "gemini-3-flash-preview",
        "gemini-3.1-pro-preview",
    ]

    rate_limit_retry_attempts: int = 4
    rate_limit_initial_wait: int = 30
    rate_limit_max_wait: int = 120

    allowed_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
