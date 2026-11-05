"""Authentication contracts.

These models are the public wire format for signup, login, refresh, logout and the authenticated
user profile. Passwords and refresh tokens are write-only and never appear in a response model
except as the newly issued pair.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

EMAIL_MAX_LENGTH = 320
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
FULL_NAME_MAX_LENGTH = 120


class SignupRequest(BaseModel):
    """Credentials and optional profile for a new account."""

    email: Annotated[EmailStr, Field(max_length=EMAIL_MAX_LENGTH)]
    password: Annotated[
        str,
        Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH, repr=False),
    ]
    full_name: str | None = Field(default=None, max_length=FULL_NAME_MAX_LENGTH)

    @field_validator("email")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        """Store every address in a canonical form so uniqueness is case-insensitive."""
        return value.strip().lower()

    @field_validator("full_name")
    @classmethod
    def _normalise_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class LoginRequest(BaseModel):
    """Email and password presented to the token endpoint."""

    email: Annotated[EmailStr, Field(max_length=EMAIL_MAX_LENGTH)]
    password: Annotated[str, Field(min_length=1, max_length=PASSWORD_MAX_LENGTH, repr=False)]

    @field_validator("email")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        return value.strip().lower()


class RefreshTokenRequest(BaseModel):
    """Opaque refresh credential issued alongside an access token."""

    refresh_token: Annotated[str, Field(min_length=20, max_length=512, repr=False)]


class LogoutRequest(BaseModel):
    """Optional refresh credential identifying the session family to revoke."""

    refresh_token: str | None = Field(default=None, max_length=512, repr=False)


class UserResponse(BaseModel):
    """Public projection of a user; deliberately excludes ``hashed_password``."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str | None
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    """Token pair issued by signup, login and refresh."""

    access_token: str
    refresh_token: str = Field(
        description="Opaque, single-use refresh credential; rotate it on every refresh.",
        repr=False,
    )
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Access-token lifetime in seconds.", ge=1)
    refresh_expires_in: int = Field(description="Refresh-token lifetime in seconds.", ge=1)
    user: UserResponse
