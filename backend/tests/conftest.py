"""Test fixtures.

The suite runs against an in-memory SQLite engine so health/readiness paths exercise a real
SQLAlchemy engine without requiring PostgreSQL. PostgreSQL-specific behaviour (migrations, DDL)
is covered by the migration CI job instead.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
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
async def client(settings: Settings) -> AsyncIterator[AsyncClient]:
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as http_client:
            yield http_client
