"""Contract tests for the running stack."""

from __future__ import annotations

import httpx


def test_backend_liveness(backend: httpx.Client) -> None:
    response = backend.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"]
    assert body["uptime_seconds"] >= 0


def test_backend_readiness_reports_postgres(backend: httpx.Client) -> None:
    response = backend.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert any(dep["name"] == "postgresql" and dep["status"] == "up" for dep in body["dependencies"])


def test_backend_exposes_correlation_id(backend: httpx.Client) -> None:
    response = backend.get("/health", headers={"X-Request-ID": "integration-check"})

    assert response.headers["X-Request-ID"] == "integration-check"
    assert float(response.headers["X-Process-Time-Ms"]) >= 0


def test_backend_error_envelope(backend: httpx.Client) -> None:
    response = backend.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_backend_cors_allows_frontend_origin(backend: httpx.Client) -> None:
    origin = "http://localhost:3000"
    response = backend.options(
        "/api/v1/health",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )

    assert response.status_code in (200, 204)
    assert response.headers["access-control-allow-origin"] == origin


def test_frontend_reports_backend_and_database(web: httpx.Client) -> None:
    response = web.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    names = {dep["name"]: dep["status"] for dep in body["dependencies"]}
    assert names.get("backend-api") == "up"
    assert names.get("postgresql") == "up"


def test_frontend_health_is_not_cached(web: httpx.Client) -> None:
    response = web.get("/api/health")

    assert "no-store" in response.headers.get("cache-control", "")


def test_frontend_renders_landing_page(web: httpx.Client) -> None:
    response = web.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "Nexa AI" in response.text
    assert "Foundation status" in response.text
