"""Contract tests for the running stack."""

from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path

import httpx
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
DB_SERVICE = "db"
RECOVERY_TIMEOUT = 90


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
    assert any(
        dep["name"] == "postgresql" and dep["status"] == "up" for dep in body["dependencies"]
    )


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


def _compose(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    """Run a compose subcommand against the stack this test session is checking."""
    return subprocess.run(
        ["docker", "compose", *args],
        cwd=REPO_ROOT,
        check=check,
        capture_output=True,
        text=True,
        timeout=180,
    )


def _require_compose_database() -> None:
    """Only a stack managed by compose can be taken down and brought back up here."""
    if shutil.which("docker") is None:
        pytest.skip("docker CLI unavailable; start the compose stack to test database recovery")
    services = _compose("ps", "--services", "--status", "running", check=False)
    if services.returncode != 0 or DB_SERVICE not in services.stdout.split():
        pytest.skip(f"compose service '{DB_SERVICE}' is not running; run `docker compose up -d`")


def _wait_for_readiness(
    client: httpx.Client, expected_status: int, timeout: int = RECOVERY_TIMEOUT
) -> httpx.Response:
    """Poll readiness until it answers ``expected_status``; fail with the last status otherwise."""
    deadline = time.monotonic() + timeout
    last_status: int | str = "no response"
    while time.monotonic() < deadline:
        try:
            response = client.get("/api/v1/health")
        except httpx.HTTPError as exc:
            last_status = type(exc).__name__
        else:
            last_status = response.status_code
            if response.status_code == expected_status:
                return response
        time.sleep(1)
    pytest.fail(
        f"readiness did not return {expected_status} within {timeout}s (last: {last_status})"
    )


def test_readiness_degrades_and_recovers_when_postgres_stops(backend: httpx.Client) -> None:
    """Stopping PostgreSQL must fail readiness closed with 503 and recover after it restarts."""
    _require_compose_database()

    healthy = _wait_for_readiness(backend, 200).json()
    assert any(
        dep["name"] == "postgresql" and dep["status"] == "up" for dep in healthy["dependencies"]
    )

    _compose("stop", DB_SERVICE)
    try:
        degraded = _wait_for_readiness(backend, 503).json()
        assert degraded["status"] == "degraded"
        postgres = next(dep for dep in degraded["dependencies"] if dep["name"] == "postgresql")
        assert postgres["status"] == "down"
        assert postgres["detail"] == "database_unreachable"

        # Liveness is an I/O-free probe: the process stays healthy while the database is down.
        assert backend.get("/api/v1/health/live").status_code == 200
    finally:
        # Always restore the service, even when an assertion above fails.
        _compose("start", DB_SERVICE)

    recovered = _wait_for_readiness(backend, 200).json()
    assert recovered["status"] == "ok"
    assert any(
        dep["name"] == "postgresql" and dep["status"] == "up" for dep in recovered["dependencies"]
    )
