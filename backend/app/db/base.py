"""Declarative base, constraint naming conventions and shared mixins.

Deterministic constraint names keep Alembic migrations diffable and make future schema changes
predictable across environments.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, MetaData, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Root of every ORM model."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPrimaryKeyMixin:
    """UUID v4 primary key generated application-side (portable across databases)."""

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


def utcnow() -> datetime:
    """Application clock for bookkeeping columns."""
    return datetime.now(tz=UTC)


class TimestampMixin:
    """Created/updated bookkeeping columns.

    The application supplies the values instead of leaving them to the database, so every dialect
    stores the same thing: SQLite has no ``now()`` function, and a table created by the migrations
    therefore rejected inserts that relied on the PostgreSQL default. ``server_default`` is kept so
    the DDL still matches the migrations and out-of-band SQL writes get a timestamp on PostgreSQL.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        server_default=func.now(),
        nullable=False,
    )
