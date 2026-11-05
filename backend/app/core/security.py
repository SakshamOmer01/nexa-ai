"""Security primitives.

Password hashing (Argon2id) and JWT issuing/verification live here so authentication features
added later share one audited implementation instead of re-implementing crypto per endpoint.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.core.config import Settings, get_settings

_password_hash = PasswordHash.recommended()


class TokenError(Exception):
    """Raised when a token is malformed, expired or signed with the wrong key."""


def hash_password(password: str) -> str:
    """Return an Argon2id hash for ``password``."""
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Check ``password`` against a stored hash, returning ``False`` on any mismatch."""
    try:
        return _password_hash.verify(password, password_hash)
    except Exception:
        return False


def create_access_token(
    subject: str,
    *,
    settings: Settings | None = None,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Create a signed JWT access token for ``subject``."""
    config = settings or get_settings()
    now = datetime.now(tz=UTC)
    expire = now + (expires_delta or timedelta(minutes=config.access_token_expire_minutes))
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "type": "access",
        **(extra_claims or {}),
    }
    return jwt.encode(
        payload,
        config.secret_key.get_secret_value(),
        algorithm=config.jwt_algorithm,
    )


def decode_access_token(token: str, *, settings: Settings | None = None) -> dict[str, Any]:
    """Verify a token signature and expiry, returning its claims."""
    config = settings or get_settings()
    try:
        claims: dict[str, Any] = jwt.decode(
            token,
            config.secret_key.get_secret_value(),
            algorithms=[config.jwt_algorithm],
            options={"require": ["sub", "exp"]},
        )
    except jwt.PyJWTError as exc:  # pragma: no cover - depends on library internals
        raise TokenError(str(exc)) from exc
    if claims.get("type") != "access":
        raise TokenError("Unexpected token type.")
    return claims
