"""Portability guard for the bookkeeping columns.

The migrations create ``created_at``/``updated_at`` with a PostgreSQL ``now()`` default. SQLite has
no such function, so when the tables come from the migrations — which is how the SQLite path for
local development runs — a row must carry its own timestamps or the first write fails with
``unknown function: now()``.

Creating tables from the model metadata would hide that: SQLAlchemy compiles ``func.now()`` to
``CURRENT_TIMESTAMP`` on SQLite, so the bug only appears against migration-created DDL. These tests
build a table with exactly that DDL and write through the ORM.
"""

from __future__ import annotations

import uuid

from fastapi import FastAPI
from sqlalchemy import Uuid, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.db.base import TimestampMixin


class ProbeBase(DeclarativeBase):
    """Isolated registry, so the probe table never joins the application metadata."""


class Probe(TimestampMixin, ProbeBase):
    __tablename__ = "timestamp_probe"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    label: Mapped[str | None] = mapped_column(default=None, nullable=True)


# Mirrors what ``alembic upgrade head`` emits for SQLite: a literal now() that SQLite cannot
# evaluate, so a row inserted without an explicit timestamp fails.
PROBE_DDL = """
CREATE TABLE timestamp_probe (
    id CHAR(32) NOT NULL PRIMARY KEY,
    label VARCHAR(32),
    created_at DATETIME DEFAULT (now()) NOT NULL,
    updated_at DATETIME DEFAULT (now()) NOT NULL
)
"""


async def create_probe_table(app: FastAPI) -> None:
    async with app.state.db.engine.begin() as connection:
        await connection.execute(text(PROBE_DDL))


async def test_insert_supplies_its_own_timestamps(app: FastAPI) -> None:
    await create_probe_table(app)

    async with app.state.db.session_factory() as session:
        probe = Probe()
        session.add(probe)
        await session.commit()

        # The write only succeeds because the ORM sent both columns explicitly.
        assert probe.created_at is not None
        assert probe.updated_at is not None


async def test_update_advances_updated_at(app: FastAPI) -> None:
    await create_probe_table(app)

    async with app.state.db.session_factory() as session:
        probe = Probe(label="first")
        session.add(probe)
        await session.commit()
        before = probe.updated_at

        probe.label = "second"
        await session.commit()

        assert probe.updated_at >= before
        assert probe.label == "second"
