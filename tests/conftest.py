"""Fixtures for cross-service integration tests.

These tests talk to a *running* stack (docker compose or scripts/dev.sh) rather than importing
service code, so they verify the real contracts between containers.
"""

from __future__ import annotations

import os
import time
from collections.abc import Iterator

import httpx
import pytest

BACKEND_URL = os.getenv("NEXA_BACKEND_URL", "http://localhost:8000").rstrip("/")
FRONTEND_URL = os.getenv("NEXA_FRONTEND_URL", "http://localhost:3000").rstrip("/")
STARTUP_TIMEOUT = int(os.getenv("NEXA_STARTUP_TIMEOUT", "120"))


def _wait_for(url: str, timeout: int = STARTUP_TIMEOUT) -> None:
    deadline = time.monotonic() + timeout
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            response = httpx.get(url, timeout=3.0)
            if response.status_code < 500:
                return
        except httpx.HTTPError as exc:  # service not accepting connections yet
            last_error = exc
        time.sleep(1)
    pytest.fail(f"{url} did not become reachable within {timeout}s ({last_error})")


@pytest.fixture(scope="session")
def backend_url() -> str:
    _wait_for(f"{BACKEND_URL}/health")
    return BACKEND_URL


@pytest.fixture(scope="session")
def frontend_url() -> str:
    _wait_for(f"{FRONTEND_URL}/api/health")
    return FRONTEND_URL


@pytest.fixture(scope="session")
def backend(backend_url: str) -> Iterator[httpx.Client]:
    with httpx.Client(base_url=backend_url, timeout=10.0) as client:
        yield client


@pytest.fixture(scope="session")
def web(frontend_url: str) -> Iterator[httpx.Client]:
    with httpx.Client(base_url=frontend_url, timeout=10.0, follow_redirects=True) as client:
        yield client
