"""End-to-end guard for the SQLite local-development path.

The rest of the suite builds its schema with ``Base.metadata.create_all``, which compiles
``func.now()`` to ``CURRENT_TIMESTAMP`` on SQLite. That hides a migration DDL SQLite cannot
evaluate, so the API could pass every unit test and still reject its first write when a developer
ran the migrations against a SQLite file.

This module applies the real migrations — in a subprocess, exactly as ``alembic upgrade head``
does — then drives the auth flow through the application, so a PostgreSQL-only default or
statement fails the build instead of a laptop.
"""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PASSWORD = "local-dev-password-123"
SECRET_KEY = "test-secret-key-with-at-least-32-characters"


@pytest.fixture
def sqlite_database(tmp_path: Path) -> tuple[str, Path]:
    """Apply every migration to a throwaway SQLite file the way a local dev would."""
    database_path = tmp_path / "dev.db"
    url = f"sqlite+aiosqlite:///{database_path}"
    completed = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        env={
            **os.environ,
            "DATABASE_URL": url,
            "ENVIRONMENT": "test",
            "SECRET_KEY": SECRET_KEY,
        },
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr
    assert database_path.exists()
    return url, database_path


@pytest.fixture
def migrated_app(sqlite_database: tuple[str, Path]) -> FastAPI:
    url, _ = sqlite_database
    return create_app(
        Settings(
            environment="test",
            log_level="WARNING",
            database_url=url,
            secret_key=SECRET_KEY,
        )
    )


@pytest.fixture
async def migrated_client(migrated_app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with migrated_app.router.lifespan_context(migrated_app):
        transport = ASGITransport(app=migrated_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            yield client


def test_migrations_create_the_expected_schema(sqlite_database: tuple[str, Path]) -> None:
    _, database_path = sqlite_database

    with sqlite3.connect(database_path) as connection:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master")}

    assert {"alembic_version", "users", "refresh_tokens"} <= tables


async def test_readiness_uses_the_migrated_database(migrated_client: AsyncClient) -> None:
    response = await migrated_client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert any(dependency["status"] == "up" for dependency in body["dependencies"])


async def test_auth_flow_works_on_a_migrated_sqlite_database(
    migrated_client: AsyncClient,
) -> None:
    """Registration, login and token rotation all write rows with timestamps."""
    signup = await migrated_client.post(
        "/api/v1/auth/signup",
        json={"email": "local-dev@example.com", "password": PASSWORD, "full_name": "Local Dev"},
    )
    assert signup.status_code == 201
    created = signup.json()
    assert created["user"]["created_at"]

    me = await migrated_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {created['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["is_active"] is True

    duplicate = await migrated_client.post(
        "/api/v1/auth/signup",
        json={"email": "local-dev@example.com", "password": PASSWORD},
    )
    assert duplicate.status_code == 409

    login = await migrated_client.post(
        "/api/v1/auth/login",
        json={"email": "LOCAL-DEV@example.com", "password": PASSWORD},
    )
    assert login.status_code == 200

    refresh = await migrated_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login.json()["refresh_token"]},
    )
    assert refresh.status_code == 200
    rotated = refresh.json()
    assert rotated["refresh_token"] != login.json()["refresh_token"]

    logout = await migrated_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": rotated["refresh_token"]},
        headers={"Authorization": f"Bearer {rotated['access_token']}"},
    )
    assert logout.status_code in (200, 204)
