"""Authentication endpoints.

* ``POST /auth/signup`` — create an account, returning a bearer token (HTTP 201).
* ``POST /auth/login``  — exchange credentials for a bearer token.
* ``GET  /auth/me``     — protected route; requires ``Authorization: Bearer <token>``.

Success responses never include password material; failures use the shared error envelope and a
``WWW-Authenticate: Bearer`` challenge.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import AuthServiceDep, CurrentUserDep
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

_UNAUTHORIZED = {401: {"description": "Missing, invalid or expired bearer token"}}


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account",
    description="Register an email/password account and return an access token.",
    responses={409: {"description": "Email already registered"}},
)
async def signup(payload: SignupRequest, auth: AuthServiceDep) -> TokenResponse:
    return await auth.register(payload)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Exchange credentials for a token",
    description="Verify email and password and return an access token.",
    responses=_UNAUTHORIZED,
)
async def login(payload: LoginRequest, auth: AuthServiceDep) -> TokenResponse:
    return await auth.authenticate(payload.email, payload.password)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Current user",
    description="Protected route. Returns the account identified by the bearer token.",
    responses=_UNAUTHORIZED,
)
async def read_current_user(current_user: CurrentUserDep) -> UserResponse:
    return current_user
