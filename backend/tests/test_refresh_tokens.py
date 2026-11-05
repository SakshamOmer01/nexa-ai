"""Refresh-token rotation and revocation tests.

The important properties are rotation on every use, digest-only storage, family revocation when a
rotated token is replayed outside the concurrency grace period, and immediate revocation on logout.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import decode_access_token, hash_refresh_token
from app.models.refresh_token import RefreshToken
from app.models.user import User

PASSWORD = "correct-horse-battery-staple"
SIGNUP_PAYLOAD = {
    "email": "ada@example.com",
    "password": PASSWORD,
    "full_name": "Ada Lovelace",
}


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def signup(client: AsyncClient, **overrides: object) -> dict[str, object]:
    response = await client.post("/api/v1/auth/signup", json={**SIGNUP_PAYLOAD, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


async def refresh(client: AsyncClient, token: object) -> dict[str, object]:
    response = await client.post("/api/v1/auth/refresh", json={"refresh_token": token})
    assert response.status_code == 200, response.text
    return response.json()


async def stored_token(db_session: AsyncSession, token: object) -> RefreshToken:
    row = await db_session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(str(token)))
    )
    assert row is not None
    return row


async def test_signup_and_login_issue_a_hashed_refresh_token(
    client: AsyncClient, db_session: AsyncSession, settings: Settings
) -> None:
    body = await signup(client)

    assert body["refresh_token"]
    assert body["refresh_expires_in"] == settings.refresh_token_expire_days * 24 * 60 * 60
    assert body["refresh_token"] not in str(body["user"])

    row = await stored_token(db_session, body["refresh_token"])
    assert row.token_hash == hash_refresh_token(str(body["refresh_token"]))
    assert row.revoked_at is None
    assert row.family_id

    login = await client.post(
        "/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD}
    )
    assert login.status_code == 200
    login_row = await stored_token(db_session, login.json()["refresh_token"])
    assert login_row.family_id != row.family_id


async def test_refresh_rotates_the_token_and_keeps_the_access_token_working(
    client: AsyncClient, settings: Settings
) -> None:
    first = await signup(client)
    second = await refresh(client, first["refresh_token"])

    assert second["refresh_token"] != first["refresh_token"]
    assert second["user"]["id"] == first["user"]["id"]

    claims = decode_access_token(str(second["access_token"]), settings=settings)
    assert claims["sub"] == second["user"]["id"]

    me = await client.get("/api/v1/auth/me", headers=bearer(str(second["access_token"])))
    assert me.status_code == 200


async def test_concurrent_replay_inside_grace_does_not_revoke_the_family(
    client: AsyncClient,
) -> None:
    first = await signup(client)
    second = await refresh(client, first["refresh_token"])

    # A second tab still holding the old token: rejected, but it must not kill the session.
    replay = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert replay.status_code == 401

    third = await refresh(client, second["refresh_token"])
    assert third["refresh_token"] not in {first["refresh_token"], second["refresh_token"]}


async def test_replay_after_grace_revokes_the_whole_family(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    first = await signup(client)
    second = await refresh(client, first["refresh_token"])

    row = await stored_token(db_session, first["refresh_token"])
    row.revoked_at = datetime.now(tz=UTC) - timedelta(minutes=5)
    await db_session.commit()

    replay = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert replay.status_code == 401

    successor = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": second["refresh_token"]}
    )
    assert successor.status_code == 401

    db_session.expire_all()
    rows = (await db_session.scalars(select(RefreshToken))).all()
    assert rows
    assert all(entry.revoked_at is not None for entry in rows)


async def test_logout_revokes_the_session_and_is_idempotent(client: AsyncClient) -> None:
    first = await signup(client)

    logout = await client.post(
        "/api/v1/auth/logout", json={"refresh_token": first["refresh_token"]}
    )
    assert logout.status_code == 204
    assert logout.content == b""

    rejected = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert rejected.status_code == 401
    assert rejected.json()["error"]["code"] == "unauthorized"

    again = await client.post("/api/v1/auth/logout", json={"refresh_token": first["refresh_token"]})
    assert again.status_code == 204

    without_body = await client.post("/api/v1/auth/logout")
    assert without_body.status_code == 204


async def test_logout_only_revokes_its_own_family(client: AsyncClient) -> None:
    first = await signup(client)
    login = await client.post(
        "/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD}
    )
    second = login.json()

    await client.post("/api/v1/auth/logout", json={"refresh_token": first["refresh_token"]})

    assert (
        await client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    ).status_code == 401
    other_session = await refresh(client, second["refresh_token"])
    assert other_session["user"]["id"] == first["user"]["id"]


async def test_expired_refresh_token_is_rejected_and_revoked(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    first = await signup(client)
    row = await stored_token(db_session, first["refresh_token"])
    row.expires_at = datetime.now(tz=UTC) - timedelta(seconds=1)
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"

    db_session.expire_all()
    await db_session.refresh(row)
    assert row.revoked_at is not None


async def test_deactivated_account_cannot_refresh(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    first = await signup(client)
    user = await db_session.scalar(select(User).where(User.email == "ada@example.com"))
    assert user is not None
    user.is_active = False
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert response.status_code == 401

    db_session.expire_all()
    rows = (await db_session.scalars(select(RefreshToken))).all()
    assert all(entry.revoked_at is not None for entry in rows)


async def test_unknown_and_malformed_refresh_tokens_fail_generically(client: AsyncClient) -> None:
    unknown = await client.post("/api/v1/auth/refresh", json={"refresh_token": "x" * 43})
    short = await client.post("/api/v1/auth/refresh", json={"refresh_token": "too-short"})

    assert unknown.status_code == 401
    assert unknown.json()["error"]["code"] == "unauthorized"
    assert unknown.headers["WWW-Authenticate"] == "Bearer"
    assert short.status_code == 422
    assert short.json()["error"]["code"] == "validation_error"


async def test_refresh_response_never_leaks_credentials(client: AsyncClient) -> None:
    first = await signup(client)
    rotated = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )

    assert PASSWORD not in rotated.text
    assert "hashed_password" not in rotated.text
    assert "token_hash" not in rotated.text
    assert "refresh_token" in rotated.json()


async def test_openapi_documents_refresh_and_logout(client: AsyncClient) -> None:
    schema = (await client.get("/openapi.json")).json()
    paths = schema["paths"]

    assert "/api/v1/auth/refresh" in paths
    assert "/api/v1/auth/logout" in paths
    assert "204" in paths["/api/v1/auth/logout"]["post"]["responses"]
    assert "get" not in paths["/api/v1/auth/logout"]
