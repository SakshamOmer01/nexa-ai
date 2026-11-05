"""Health endpoint contract tests."""

from __future__ import annotations

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.config import Settings
from app.main import create_app


async def test_liveness_is_cheap_and_ok(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/live")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["environment"] == "test"
    assert body["service"]
    assert body["version"]
    assert body["uptime_seconds"] >= 0


async def test_readiness_reports_dependencies_up(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert [dep["name"] for dep in body["dependencies"]] == ["postgresql"]
    assert body["dependencies"][0]["status"] == "up"


async def test_readiness_returns_503_when_database_is_down(settings: Settings) -> None:
    app = create_app(settings)
    broken_session = AsyncMock(spec=AsyncSession)
    broken_session.execute.side_effect = OperationalError("SELECT 1", {}, Exception("down"))

    async def _override_session() -> AsyncIterator[AsyncSession]:
        yield broken_session

    app.dependency_overrides[deps.get_db_session] = _override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as http_client:
        response = await http_client.get("/api/v1/health")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["dependencies"][0]["status"] == "down"
    assert body["dependencies"][0]["detail"] == "database_unreachable"


async def test_prefix_free_liveness_alias(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_service_info(client: AsyncClient) -> None:
    response = await client.get("/")

    assert response.status_code == 200
    body = response.json()
    assert body["api_prefix"] == "/api/v1"
    assert body["docs_url"] == "/docs"


async def test_request_id_and_security_headers(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/live", headers={"X-Request-ID": "abc-123"})

    assert response.headers["X-Request-ID"] == "abc-123"
    assert float(response.headers["X-Process-Time-Ms"]) >= 0
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


@pytest.mark.parametrize("candidate", ["bad id with spaces", "x" * 200, "<script>"])
async def test_untrusted_request_ids_are_replaced(client: AsyncClient, candidate: str) -> None:
    response = await client.get("/api/v1/health/live", headers={"X-Request-ID": candidate})

    assert response.headers["X-Request-ID"] != candidate
    assert len(response.headers["X-Request-ID"]) == 32


async def test_unknown_route_uses_error_envelope(client: AsyncClient) -> None:
    response = await client.get("/api/v1/missing")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "not_found"
    assert body["request_id"]


async def test_openapi_available_in_non_production(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    assert "/api/v1/health" in response.json()["paths"]
