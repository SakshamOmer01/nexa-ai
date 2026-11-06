"""Credential-endpoint rate limiting tests.

The limiter is per identity: the account email for login/signup and a digest of the presented token
for refresh. These tests pin the budget, the error contract (429 + ``Retry-After``) and the
single-instance scope documented in ``docs/phase-1.md``.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.core.config import Settings
from app.core.rate_limit import FixedWindowRateLimiter

PASSWORD = "correct-horse-battery-staple"


class FakeClock:
    """A monotonic clock tests can advance without sleeping."""

    def __init__(self, now: float = 1_000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def settings() -> Settings:
    """Override the suite default with a two-attempt budget."""

    return Settings(
        environment="test",
        debug=False,
        log_level="WARNING",
        database_url="sqlite+aiosqlite:///:memory:",
        secret_key="test-secret-key-with-at-least-32-characters",
        cors_origins=["http://localhost:3000"],
        auth_rate_limit_attempts=2,
        auth_rate_limit_window_seconds=60,
    )


def login_payload(email: str, password: str = PASSWORD) -> dict[str, str]:
    return {"email": email, "password": password}


async def test_login_budget_is_per_account(client: AsyncClient) -> None:
    for _ in range(2):
        response = await client.post("/api/v1/auth/login", json=login_payload("ada@example.com"))
        assert response.status_code == 401

    limited = await client.post("/api/v1/auth/login", json=login_payload("ada@example.com"))

    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "rate_limited"
    assert limited.json()["request_id"]
    assert int(limited.headers["Retry-After"]) >= 1

    # Another account keeps its own budget: one noisy address cannot lock everyone out.
    other = await client.post("/api/v1/auth/login", json=login_payload("grace@example.com"))
    assert other.status_code == 401


async def test_successful_logins_also_spend_the_budget(client: AsyncClient) -> None:
    signup = await client.post(
        "/api/v1/auth/signup",
        json={"email": "ada@example.com", "password": PASSWORD},
    )
    assert signup.status_code == 201

    for _ in range(2):
        response = await client.post("/api/v1/auth/login", json=login_payload("ada@example.com"))
        assert response.status_code == 200

    limited = await client.post("/api/v1/auth/login", json=login_payload("ada@example.com"))
    assert limited.status_code == 429


async def test_refresh_replay_attempts_are_limited(client: AsyncClient) -> None:
    signup = await client.post(
        "/api/v1/auth/signup",
        json={"email": "ada@example.com", "password": PASSWORD},
    )
    refresh_token = signup.json()["refresh_token"]

    rotated = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert rotated.status_code == 200

    replay = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert replay.status_code == 401

    limited = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "rate_limited"


async def test_rate_limiting_can_be_disabled(client: AsyncClient, app: FastAPI) -> None:
    app.state.settings.rate_limit_enabled = False

    for _ in range(5):
        response = await client.post("/api/v1/auth/login", json=login_payload("ada@example.com"))
        assert response.status_code == 401


def test_limiter_allows_then_blocks_and_recovers() -> None:
    clock = FakeClock()
    limiter = FixedWindowRateLimiter(clock=clock)

    first = limiter.hit("login:ada@example.com", limit=2, window_seconds=60)
    second = limiter.hit("login:ada@example.com", limit=2, window_seconds=60)
    blocked = limiter.hit("login:ada@example.com", limit=2, window_seconds=60)

    assert first.allowed is True
    assert first.remaining == 1
    assert second.allowed is True
    assert second.remaining == 0
    assert blocked.allowed is False
    assert blocked.remaining == 0
    assert blocked.retry_after_seconds == 60

    clock.now += 30
    still_blocked = limiter.hit("login:ada@example.com", limit=2, window_seconds=60)
    assert still_blocked.allowed is False
    assert still_blocked.retry_after_seconds == 30

    clock.now += 30
    assert limiter.hit("login:ada@example.com", limit=2, window_seconds=60).allowed is True


def test_limiter_keeps_keys_independent() -> None:
    limiter = FixedWindowRateLimiter(clock=FakeClock())

    limiter.hit("login:a", limit=1, window_seconds=60)
    limiter.hit("login:a", limit=1, window_seconds=60)

    assert limiter.hit("login:b", limit=1, window_seconds=60).allowed is True


@pytest.mark.parametrize(
    ("limit", "window_seconds"),
    [(0, 60), (1, 0)],
)
def test_limiter_rejects_invalid_budgets(limit: int, window_seconds: int) -> None:
    limiter = FixedWindowRateLimiter()

    with pytest.raises(ValueError):
        limiter.hit("key", limit=limit, window_seconds=window_seconds)


def test_reset_drops_every_bucket() -> None:
    clock = FakeClock()
    limiter = FixedWindowRateLimiter(clock=clock)
    limiter.hit("key", limit=1, window_seconds=60)
    assert limiter.hit("key", limit=1, window_seconds=60).allowed is False

    limiter.reset()

    assert limiter.hit("key", limit=1, window_seconds=60).allowed is True


def test_expired_buckets_are_pruned_once_the_table_grows() -> None:
    clock = FakeClock()
    limiter = FixedWindowRateLimiter(clock=clock)
    for index in range(1024):
        limiter.hit(f"key-{index}", limit=1, window_seconds=60)

    clock.now += 61
    limiter.hit("fresh", limit=1, window_seconds=60)

    # Only the fresh key survives: the 1024 expired windows were dropped in one pass.
    assert len(limiter._windows) == 1
