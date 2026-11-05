"""Security primitive tests."""

from __future__ import annotations

from datetime import timedelta

import pytest

from app.core.config import Settings
from app.core.security import (
    TokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


@pytest.fixture
def settings() -> Settings:
    return Settings(
        environment="test",
        secret_key="test-secret-key-with-at-least-32-characters",
        database_url="sqlite+aiosqlite:///:memory:",
    )


def test_password_roundtrip() -> None:
    hashed = hash_password("correct horse battery staple")

    assert hashed != "correct horse battery staple"
    assert verify_password("correct horse battery staple", hashed) is True
    assert verify_password("wrong password", hashed) is False


def test_verify_password_handles_invalid_hash() -> None:
    assert verify_password("anything", "not-a-valid-hash") is False


def test_access_token_roundtrip(settings: Settings) -> None:
    token = create_access_token("user-123", settings=settings, extra_claims={"role": "admin"})

    claims = decode_access_token(token, settings=settings)
    assert claims["sub"] == "user-123"
    assert claims["role"] == "admin"
    assert claims["type"] == "access"


def test_expired_token_is_rejected(settings: Settings) -> None:
    token = create_access_token("user-123", settings=settings, expires_delta=timedelta(seconds=-1))

    with pytest.raises(TokenError):
        decode_access_token(token, settings=settings)


def test_token_signed_with_other_key_is_rejected(settings: Settings) -> None:
    attacker = Settings(
        environment="test",
        secret_key="a-different-secret-key-also-32-characters",
        database_url="sqlite+aiosqlite:///:memory:",
    )
    token = create_access_token("user-123", settings=attacker)

    with pytest.raises(TokenError):
        decode_access_token(token, settings=settings)
