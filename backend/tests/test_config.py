"""Settings validation tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_cors_origins_accept_csv() -> None:
    settings = Settings(cors_origins="https://a.example, https://b.example")

    assert settings.cors_origins == ["https://a.example", "https://b.example"]


def test_database_url_requires_async_driver() -> None:
    with pytest.raises(ValidationError, match="async driver"):
        Settings(database_url="postgresql://nexa:nexa@localhost:5432/nexa")


def test_docs_disabled_by_default_in_production() -> None:
    settings = Settings(
        environment="production",
        secret_key="p" * 40,
        cors_origins=["https://nexa.example"],
    )

    assert settings.is_production is True
    assert settings.is_docs_enabled is False


@pytest.mark.parametrize(
    "overrides",
    [
        {"secret_key": "changeme"},
        {"secret_key": "short"},
        {"debug": True},
        {"cors_origins": ["*"]},
    ],
)
def test_production_rejects_insecure_defaults(overrides: dict[str, object]) -> None:
    payload: dict[str, object] = {
        "environment": "production",
        "secret_key": "p" * 40,
        "cors_origins": ["https://nexa.example"],
        **overrides,
    }

    with pytest.raises(ValidationError):
        Settings(**payload)  # type: ignore[arg-type]
