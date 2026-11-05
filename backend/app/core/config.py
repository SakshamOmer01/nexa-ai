"""Typed application settings.

Configuration is read once from the environment (optionally a ``.env`` file) and validated at
start-up, so a misconfigured deployment fails fast instead of surfacing later at request time.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

Environment = Literal["development", "test", "staging", "production"]

_PLACEHOLDER_SECRETS = {
    "secret",
    "changeme",
    "change-me",
    "dev-only-insecure-secret-change-me",
    "your-secret-key",
}
_SUPPORTED_DATABASE_SCHEMES = ("postgresql+asyncpg://", "sqlite+aiosqlite://")


class Settings(BaseSettings):
    """Runtime configuration for the Nexa AI API."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Service identity ---------------------------------------------------------------
    app_name: str = "Nexa AI API"
    app_version: str = "0.1.0"
    environment: Environment = "development"
    debug: bool = False
    log_level: str = "INFO"
    api_v1_prefix: str = "/api/v1"
    docs_enabled: bool | None = None

    # --- Security -----------------------------------------------------------------------
    secret_key: SecretStr = SecretStr("dev-only-insecure-secret-change-me")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=30, ge=1, le=60 * 24 * 30)

    # --- Persistence --------------------------------------------------------------------
    database_url: str = "postgresql+asyncpg://nexa:nexa@localhost:5432/nexa"
    database_pool_size: int = Field(default=5, ge=1, le=50)
    database_max_overflow: int = Field(default=10, ge=0, le=50)
    database_pool_timeout_seconds: float = Field(default=30.0, gt=0)
    database_echo: bool = False

    # --- HTTP ---------------------------------------------------------------------------
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept comma-separated origins (``A,B``) as well as JSON lists."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("database_url")
    @classmethod
    def _validate_database_url(cls, value: str) -> str:
        if not value.startswith(_SUPPORTED_DATABASE_SCHEMES):
            raise ValueError(
                "DATABASE_URL must use an async driver: "
                "'postgresql+asyncpg://...' (or 'sqlite+aiosqlite://' for tests)."
            )
        return value

    @field_validator("log_level")
    @classmethod
    def _normalise_log_level(cls, value: str) -> str:
        level = value.upper()
        allowed = {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}
        if level not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {sorted(allowed)}")
        return level

    @model_validator(mode="after")
    def _guard_production(self) -> Settings:
        """Refuse to start production with development defaults."""
        if self.environment != "production":
            return self

        secret = self.secret_key.get_secret_value()
        if secret in _PLACEHOLDER_SECRETS or len(secret) < 32:
            raise ValueError("SECRET_KEY must be a unique value of at least 32 characters.")
        if self.debug:
            raise ValueError("DEBUG must be disabled in production.")
        if "*" in self.cors_origins:
            raise ValueError("CORS_ORIGINS must list explicit origins in production.")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_docs_enabled(self) -> bool:
        """Interactive docs default to on everywhere except production."""
        if self.docs_enabled is not None:
            return self.docs_enabled
        return not self.is_production


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings singleton."""
    return Settings()
