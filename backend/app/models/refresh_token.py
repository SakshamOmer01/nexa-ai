"""Rotating refresh-token records.

Only a SHA-256 digest of each opaque token is stored, so a database leak cannot be replayed
directly. Every login starts a *family*; rotating a token revokes the presented row and links it to
its successor in the same family. Replaying a rotated token after a short concurrency grace period
revokes the whole family, which is how theft is detected.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class RefreshToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # All tokens descended from one login share a family id.
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Set when this token is rotated so audit trails can follow the chain.
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<RefreshToken id={self.id} family={self.family_id} revoked={self.revoked_at}>"
