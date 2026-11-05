"""Authentication use cases.

Registration, credential verification, access-token issuance and refresh-token rotation live here
so routers stay a thin HTTP layer and the same rules apply to every caller (API today, CLI or admin
tooling later).

Refresh tokens are opaque secrets stored as SHA-256 digests. Each login starts a family; every
refresh rotates the presented token into a successor in the same family. Replaying a rotated token
after a short grace period is treated as theft and revokes the family. The grace period keeps
legitimate concurrent requests (two tabs refreshing at once) from logging the user out.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import AuthenticationError, ConflictError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import SignupRequest, TokenResponse, UserResponse

BEARER_CHALLENGE = {"WWW-Authenticate": "Bearer"}

# Verified against when no account matches so a failed login costs the same Argon2 work as a
# successful one, which keeps response timing from revealing whether an email is registered.
_DUMMY_PASSWORD_HASH = hash_password("nexa-ai-invalid-credential-timing-guard")

_DUPLICATE_EMAIL = "An account with this email already exists."

# Two requests holding the same refresh token can race during a page load. The loser sees a token
# that was revoked microseconds ago, so only a replay outside this window is treated as theft.
_REFRESH_REUSE_GRACE = timedelta(seconds=30)


def _invalid_credentials() -> AuthenticationError:
    """Return the single generic failure used for every login rejection."""
    return AuthenticationError("Invalid email or password.", headers=BEARER_CHALLENGE)


def _invalid_refresh_token() -> AuthenticationError:
    """Return the single generic failure used for every refresh rejection."""
    return AuthenticationError("Invalid or expired refresh token.", headers=BEARER_CHALLENGE)


def _as_utc(value: datetime) -> datetime:
    """SQLite drops timezone info; normalise so expiry comparisons never mix naive/aware values."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


class AuthService:
    """Owns accounts, token pairs and authenticated-user lookup."""

    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings

    async def register(self, payload: SignupRequest) -> TokenResponse:
        """Create an account and return its first token pair."""
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
        return await self._issue_tokens(user)

    async def authenticate(self, email: str, password: str) -> TokenResponse:
        """Verify credentials and return a token pair, or raise a generic 401."""
        user = await self._session.scalar(select(User).where(User.email == email))
        if user is None:
            verify_password(password, _DUMMY_PASSWORD_HASH)
            raise _invalid_credentials()
        if not verify_password(password, user.hashed_password) or not user.is_active:
            raise _invalid_credentials()
        return await self._issue_tokens(user)

    async def refresh(self, refresh_token: str) -> TokenResponse:
        """Rotate a refresh token, returning a fresh pair in the same family."""
        now = datetime.now(tz=UTC)
        stored = await self._session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token))
        )
        if stored is None:
            raise _invalid_refresh_token()

        if stored.revoked_at is not None:
            revoked_at = _as_utc(stored.revoked_at)
            recently_rotated = (
                stored.replaced_by_id is not None and now - revoked_at <= _REFRESH_REUSE_GRACE
            )
            if not recently_rotated:
                await self._revoke_family(stored.family_id, now)
                await self._session.commit()
            raise _invalid_refresh_token()

        if _as_utc(stored.expires_at) <= now:
            stored.revoked_at = now
            await self._session.commit()
            raise _invalid_refresh_token()

        user = await self._session.get(User, stored.user_id)
        if user is None or not user.is_active:
            await self._revoke_family(stored.family_id, now)
            await self._session.commit()
            raise _invalid_refresh_token()

        new_token = generate_refresh_token()
        successor = RefreshToken(
            id=uuid4(),
            user_id=stored.user_id,
            family_id=stored.family_id,
            token_hash=hash_refresh_token(new_token),
            expires_at=now + timedelta(days=self._settings.refresh_token_expire_days),
        )
        self._session.add(successor)

        # Conditional update: if another request rotated this row first, do not branch the family.
        rotated = await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.id == stored.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now, replaced_by_id=successor.id)
        )
        if rotated.rowcount != 1:
            await self._session.rollback()
            raise _invalid_refresh_token()

        await self._session.commit()
        return self._token_response(user, new_token)

    async def revoke_session(self, refresh_token: str | None) -> None:
        """Revoke the family that ``refresh_token`` belongs to; always safe to call."""
        if not refresh_token:
            return

        stored = await self._session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token))
        )
        if stored is None:
            return

        await self._revoke_family(stored.family_id, datetime.now(tz=UTC))
        await self._session.commit()

    async def get_active_user(self, user_id: UUID) -> UserResponse:
        """Resolve a token subject to an enabled account, or raise a 401."""
        user = await self._session.get(User, user_id)
        if user is None or not user.is_active:
            raise AuthenticationError(
                "Invalid authentication credentials.", headers=BEARER_CHALLENGE
            )
        return UserResponse.model_validate(user)

    async def _revoke_family(self, family_id: UUID, now: datetime) -> None:
        """Revoke every still-active token descended from one login."""
        await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )

    async def _issue_tokens(self, user: User) -> TokenResponse:
        """Start a new token family for a login or signup and persist its first refresh token."""
        refresh_token = generate_refresh_token()
        now = datetime.now(tz=UTC)
        self._session.add(
            RefreshToken(
                user_id=user.id,
                family_id=uuid4(),
                token_hash=hash_refresh_token(refresh_token),
                expires_at=now + timedelta(days=self._settings.refresh_token_expire_days),
            )
        )
        await self._session.commit()
        return self._token_response(user, refresh_token)

    def _token_response(self, user: User, refresh_token: str) -> TokenResponse:
        return TokenResponse(
            access_token=create_access_token(str(user.id), settings=self._settings),
            refresh_token=refresh_token,
            expires_in=self._settings.access_token_expire_minutes * 60,
            refresh_expires_in=self._settings.refresh_token_expire_days * 24 * 60 * 60,
            user=UserResponse.model_validate(user),
        )
