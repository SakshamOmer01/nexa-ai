"""Reusable request dependencies.

Resources live on ``app.state`` (created in the lifespan handler) so the app factory stays the
single place that owns infrastructure. Tests override these functions to substitute alternate
settings or a database without patching modules.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import AuthenticationError, RateLimitedError
from app.core.rate_limit import FixedWindowRateLimiter
from app.core.security import TokenError, decode_access_token
from app.db.session import Database
from app.schemas.auth import UserResponse
from app.services.auth import BEARER_CHALLENGE, AuthService
from app.services.health import HealthService

bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="JWT bearer",
    description="Access token returned by `/api/v1/auth/login` or `/api/v1/auth/signup`.",
)


def get_app_settings(request: Request) -> Settings:
    """Return the settings bound to this application instance."""
    return request.app.state.settings  # type: ignore[no-any-return]


def get_database(request: Request) -> Database:
    return request.app.state.db  # type: ignore[no-any-return]


def get_rate_limiter(request: Request) -> FixedWindowRateLimiter:
    """Return the limiter bound to this application instance."""
    return request.app.state.rate_limiter  # type: ignore[no-any-return]


def enforce_auth_rate_limit(request: Request, *, scope: str, identity: str) -> None:
    """Spend one unit of a credential endpoint's per-identity budget.

    Raise ``RateLimitedError`` (HTTP 429 with ``Retry-After``) when the budget is exhausted. The
    identity is hashed or normalised by the caller; it never reaches a log line.
    """
    settings: Settings = request.app.state.settings  # type: ignore[no-any-return]
    if not settings.rate_limit_enabled:
        return

    limiter: FixedWindowRateLimiter = request.app.state.rate_limiter  # type: ignore[no-any-return]
    decision = limiter.hit(
        f"{scope}:{identity}",
        limit=settings.auth_rate_limit_attempts,
        window_seconds=settings.auth_rate_limit_window_seconds,
    )
    if not decision.allowed:
        raise RateLimitedError(retry_after_seconds=decision.retry_after_seconds)


async def get_db_session(
    database: Annotated[Database, Depends(get_database)],
) -> AsyncIterator[AsyncSession]:
    """Yield a session scoped to one request; the context manager rolls back on error."""
    async with database.session_factory() as session:
        yield session


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]


def get_health_service(session: SessionDep, settings: SettingsDep) -> HealthService:
    return HealthService(session=session, settings=settings)


def get_auth_service(session: SessionDep, settings: SettingsDep) -> AuthService:
    return AuthService(session=session, settings=settings)


HealthServiceDep = Annotated[HealthService, Depends(get_health_service)]
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    settings: SettingsDep,
    auth: AuthServiceDep,
) -> UserResponse:
    """Validate the bearer token and return the account it belongs to.

    Every failure mode returns the same 401 body so callers cannot distinguish a missing token
    from a forged, expired or deactivated one.
    """
    if credentials is None:
        raise AuthenticationError("Authentication required.", headers=BEARER_CHALLENGE)
    if credentials.scheme.lower() != "bearer":
        raise AuthenticationError("Invalid authentication credentials.", headers=BEARER_CHALLENGE)

    try:
        claims = decode_access_token(credentials.credentials, settings=settings)
        user_id = UUID(str(claims["sub"]))
    except (TokenError, ValueError, KeyError) as exc:
        raise AuthenticationError(
            "Invalid or expired authentication token.", headers=BEARER_CHALLENGE
        ) from exc

    return await auth.get_active_user(user_id)


CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]
