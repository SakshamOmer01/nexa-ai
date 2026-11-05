"""Authentication endpoint tests.

Covers the full HTTP flow (signup → login → protected route) plus the security properties that
matter for production: Argon2id storage, case-insensitive emails, generic login failures, and
rejection of expired, forged and deactivated credentials.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import create_access_token, decode_access_token
from app.models.user import User

PASSWORD = "correct-horse-battery-staple"
SIGNUP_PAYLOAD = {
    "email": "ada@example.com",
    "password": PASSWORD,
    "full_name": "Ada Lovelace",
}


async def signup(client: AsyncClient, **overrides: object) -> dict[str, object]:
    response = await client.post("/api/v1/auth/signup", json={**SIGNUP_PAYLOAD, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_signup_returns_token_and_public_user(
    client: AsyncClient, settings: Settings
) -> None:
    body = await signup(client)

    assert body["token_type"] == "bearer"
    assert body["expires_in"] == settings.access_token_expire_minutes * 60
    user = body["user"]
    assert isinstance(user, dict)
    assert user["email"] == "ada@example.com"
    assert user["full_name"] == "Ada Lovelace"
    assert user["is_active"] is True
    assert "hashed_password" not in user
    assert PASSWORD not in str(body)

    claims = decode_access_token(str(body["access_token"]), settings=settings)
    assert claims["sub"] == user["id"]


async def test_signup_stores_an_argon2id_hash(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await signup(client)

    user = await db_session.scalar(select(User).where(User.email == "ada@example.com"))
    assert user is not None
    assert user.hashed_password != PASSWORD
    assert user.hashed_password.startswith("$argon2id$")


async def test_signup_normalises_email_and_rejects_duplicates(client: AsyncClient) -> None:
    body = await signup(client, email="Ada@Example.COM")

    assert body["user"]["email"] == "ada@example.com"

    duplicate = await client.post(
        "/api/v1/auth/signup", json={**SIGNUP_PAYLOAD, "email": "ADA@example.com"}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "conflict"


async def test_signup_trims_and_clears_full_name(client: AsyncClient) -> None:
    trimmed = await signup(client, full_name="  Grace Hopper  ")
    assert trimmed["user"]["full_name"] == "Grace Hopper"

    anonymous = await signup(client, email="anon@example.com", full_name="   ")
    assert anonymous["user"]["full_name"] is None


@pytest.mark.parametrize(
    "overrides",
    [
        {"email": "not-an-email"},
        {"password": "short"},
        {"password": "x" * 129},
        {"full_name": "x" * 121},
    ],
)
async def test_signup_validation_uses_error_envelope(
    client: AsyncClient, overrides: dict[str, object]
) -> None:
    response = await client.post("/api/v1/auth/signup", json={**SIGNUP_PAYLOAD, **overrides})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["detail"]
    assert body["request_id"]


async def test_validation_errors_do_not_echo_passwords(client: AsyncClient) -> None:
    secret = "x" * 129

    response = await client.post("/api/v1/auth/signup", json={**SIGNUP_PAYLOAD, "password": secret})

    assert response.status_code == 422
    assert secret not in response.text


async def test_login_returns_token_usable_on_protected_route(client: AsyncClient) -> None:
    await signup(client)

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "ADA@EXAMPLE.COM", "password": PASSWORD},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]

    me = await client.get("/api/v1/auth/me", headers=bearer(token))
    assert me.status_code == 200
    assert me.json()["email"] == "ada@example.com"
    assert me.json()["full_name"] == "Ada Lovelace"


async def test_login_rejects_wrong_password_with_challenge(client: AsyncClient) -> None:
    await signup(client)

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "not-the-password"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
    assert response.headers["WWW-Authenticate"] == "Bearer"


async def test_login_does_not_reveal_whether_an_email_exists(client: AsyncClient) -> None:
    await signup(client)

    wrong_password = await client.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "not-the-password"},
    )
    unknown_email = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": PASSWORD},
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json()["error"] == unknown_email.json()["error"]


async def test_protected_route_requires_a_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "unauthorized"


@pytest.mark.parametrize("token", ["not-a-jwt", "a.b.c", ""])
async def test_protected_route_rejects_malformed_tokens(client: AsyncClient, token: str) -> None:
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


async def test_protected_route_rejects_token_signed_with_another_key(
    client: AsyncClient,
) -> None:
    attacker = Settings(
        environment="test",
        secret_key="attacker-secret-key-with-at-least-32-chars",
        database_url="sqlite+aiosqlite:///:memory:",
    )
    forged = create_access_token("00000000-0000-0000-0000-000000000001", settings=attacker)

    response = await client.get("/api/v1/auth/me", headers=bearer(forged))

    assert response.status_code == 401


async def test_protected_route_rejects_expired_token(
    client: AsyncClient, settings: Settings
) -> None:
    expired = create_access_token(
        "00000000-0000-0000-0000-000000000001",
        settings=settings,
        expires_delta=timedelta(seconds=-1),
    )

    response = await client.get("/api/v1/auth/me", headers=bearer(expired))

    assert response.status_code == 401


async def test_deactivated_account_cannot_authenticate(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    signed_up = await signup(client)
    token = str(signed_up["access_token"])

    user = await db_session.scalar(select(User).where(User.email == "ada@example.com"))
    assert user is not None
    user.is_active = False
    await db_session.commit()

    login = await client.post(
        "/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD}
    )
    me = await client.get("/api/v1/auth/me", headers=bearer(token))

    assert login.status_code == 401
    assert me.status_code == 401


async def test_password_is_write_only_in_openapi(client: AsyncClient) -> None:
    schema = (await client.get("/openapi.json")).json()

    signup_schema = schema["components"]["schemas"]["SignupRequest"]
    user_schema = schema["components"]["schemas"]["UserResponse"]

    assert "password" in signup_schema["properties"]
    assert "password" not in user_schema["properties"]
