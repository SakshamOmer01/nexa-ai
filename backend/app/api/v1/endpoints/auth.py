"""Authentication endpoints.

* ``POST /auth/signup``  — create an account, returning a token pair (HTTP 201).
* ``POST /auth/login``   — exchange credentials for a token pair.
* ``POST /auth/refresh`` — rotate a refresh token and issue a new pair.
* ``POST /auth/logout``  — revoke the session family; idempotent (HTTP 204).
* ``GET  /auth/me``      — protected route; requires ``Authorization: Bearer <token>``.

Success responses never include password material or stored token digests; failures use the shared
error envelope and a ``WWW-Authenticate: Bearer`` challenge.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from app.api.deps import AuthServiceDep, CurrentUserDep, enforce_auth_rate_limit
from app.core.security import hash_refresh_token
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_UNAUTHORIZED = {401: {"description": "Missing, invalid or expired bearer token"}}
_REFRESH_REJECTED = {401: {"description": "Invalid, expired, revoked or replayed refresh token"}}


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account",
    description="Register an email/password account and return an access/refresh token pair.",
    responses={409: {"description": "Email already registered"}},
)
async def signup(payload: SignupRequest, auth: AuthServiceDep, request: Request) -> TokenResponse:
    enforce_auth_rate_limit(request, scope="signup", identity=payload.email)
    return await auth.register(payload)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Exchange credentials for a token pair",
    description="Verify email and password and return an access/refresh token pair.",
    responses=_UNAUTHORIZED,
)
async def login(payload: LoginRequest, auth: AuthServiceDep, request: Request) -> TokenResponse:
    # Keyed on the account, not the client address: the web BFF calls the API server-side, so every
    # browser would otherwise share the frontend container's address.
    enforce_auth_rate_limit(request, scope="login", identity=payload.email)
    return await auth.authenticate(payload.email, payload.password)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate a refresh token",
    description=(
        "Exchange a refresh token for a new pair. The presented token is revoked; replaying it "
        "after a short concurrency grace period revokes the whole session family."
    ),
    responses=_REFRESH_REJECTED,
)
async def refresh(
    payload: RefreshTokenRequest, auth: AuthServiceDep, request: Request
) -> TokenResponse:
    # One bucket per presented token: rotation returns a new token and therefore a fresh budget.
    enforce_auth_rate_limit(
        request, scope="refresh", identity=hash_refresh_token(payload.refresh_token)
    )
    return await auth.refresh(payload.refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke a session",
    description=(
        "Revoke every active refresh token in the presented token's family. Idempotent: an "
        "unknown or already-revoked token still returns 204 so clients can always clear state."
    ),
)
async def logout(payload: LogoutRequest | None = None, *, auth: AuthServiceDep) -> Response:
    await auth.revoke_session(payload.refresh_token if payload else None)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Current user",
    description="Protected route. Returns the account identified by the bearer token.",
    responses=_UNAUTHORIZED,
)
async def read_current_user(current_user: CurrentUserDep) -> UserResponse:
    return current_user
