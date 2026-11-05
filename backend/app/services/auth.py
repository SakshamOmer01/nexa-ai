"""Authentication use cases.

Registration, credential verification and access-token issuance live here so routers stay a thin
HTTP layer and the same rules apply to every caller (API today, CLI or admin tooling later).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import AuthenticationError, ConflictError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import SignupRequest, TokenResponse, UserResponse

BEARER_CHALLENGE = {"WWW-Authenticate": "Bearer"}

# Verified against when no account matches so a failed login costs the same Argon2 work as a
# successful one, which keeps response timing from revealing whether an email is registered.
_DUMMY_PASSWORD_HASH = hash_password("nexa-ai-invalid-credential-timing-guard")

_DUPLICATE_EMAIL = "An account with this email already exists."


def _invalid_credentials() -> AuthenticationError:
    """Return the single generic failure used for every login rejection."""
    return AuthenticationError("Invalid email or password.", headers=BEARER_CHALLENGE)


class AuthService:
    """Owns account creation, login and authenticated-user lookup."""

    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings

    async def register(self, payload: SignupRequest) -> TokenResponse:
        """Create an account and return its first access token."""
        existing = await self._session.scalar(select(User.id).where(User.email == payload.email))
        if existing is not None:
            raise ConflictError(_DUPLICATE_EMAIL)

        user = User(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
        )
        self._session.add(user)
        try:
            await self._session.commit()
        except IntegrityError as exc:
            # The unique index is the source of truth: two concurrent signups can both pass the
            # pre-check above, and only one of them may win.
            await self._session.rollback()
            raise ConflictError(_DUPLICATE_EMAIL) from exc

        await self._session.refresh(user)
        return self._issue_token(user)

    async def authenticate(self, email: str, password: str) -> TokenResponse:
        """Verify credentials and return an access token, or raise a generic 401."""
        user = await self._session.scalar(select(User).where(User.email == email))
        if user is None:
            verify_password(password, _DUMMY_PASSWORD_HASH)
            raise _invalid_credentials()
        if not verify_password(password, user.hashed_password) or not user.is_active:
            raise _invalid_credentials()
        return self._issue_token(user)

    async def get_active_user(self, user_id: UUID) -> UserResponse:
        """Resolve a token subject to an enabled account, or raise a 401."""
        user = await self._session.get(User, user_id)
        if user is None or not user.is_active:
            raise AuthenticationError(
                "Invalid authentication credentials.", headers=BEARER_CHALLENGE
            )
        return UserResponse.model_validate(user)

    def _issue_token(self, user: User) -> TokenResponse:
        token = create_access_token(str(user.id), settings=self._settings)
        return TokenResponse(
            access_token=token,
            expires_in=self._settings.access_token_expire_minutes * 60,
            user=UserResponse.model_validate(user),
        )
