"""Test fixtures.

The suite runs against an in-memory SQLite engine so health/readiness and auth paths exercise a
real SQLAlchemy engine without requiring PostgreSQL. PostgreSQL-specific behaviour (migrations,
DDL) is covered by the migration CI job instead.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

import app.models  # Register every ORM model on Base.metadata.
from app.core.config import Settings
from app.db.base import Base
from app.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(
        environment="test",
        debug=False,
        log_level="WARNING",
        database_url="sqlite+aiosqlite:///:memory:",
        secret_key="test-secret-key-with-at-least-32-characters",
        cors_origins=["http://localhost:3000"],
    )


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with app.router.lifespan_context(app):
        async with app.state.db.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as http_client:
            yield http_client


@pytest.fixture
async def db_session(client: AsyncClient, app: FastAPI) -> AsyncIterator[AsyncSession]:
    """A session sharing the test database created by the ``client`` fixture."""
    async with app.state.db.session_factory() as session:
        yield session
