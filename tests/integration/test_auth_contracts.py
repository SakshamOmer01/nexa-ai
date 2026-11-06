"""Authentication contract tests for a running stack.

These exercise the real HTTP boundaries: the FastAPI bearer-token endpoints and the Next.js BFF
that turns a token into an httpOnly session cookie.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import httpx

PASSWORD = "integration-password-123"


def unique_email(prefix: str = "integration") -> str:
    return f"{prefix}-{uuid.uuid4().hex}@example.com"


def as_utc(value: str) -> datetime:
    """Parse an API timestamp; SQLite returns it without an offset, PostgreSQL with ``+00:00``."""
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def test_signup_login_and_protected_route(backend: httpx.Client) -> None:
    email = unique_email()
    signup = backend.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": PASSWORD, "full_name": "Integration User"},
    )

    assert signup.status_code == 201
    body = signup.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0
    assert body["user"]["email"] == email
    assert "hashed_password" not in body["user"]

    me = backend.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["id"] == body["user"]["id"]

    login = backend.post(
        "/api/v1/auth/login",
        json={"email": email.upper(), "password": PASSWORD},
    )
    assert login.status_code == 200
    assert login.json()["user"]["id"] == body["user"]["id"]


def test_duplicate_signup_and_bad_credentials(backend: httpx.Client) -> None:
    email = unique_email("duplicate")
    payload = {"email": email, "password": PASSWORD}
    assert backend.post("/api/v1/auth/signup", json=payload).status_code == 201

    duplicate = backend.post("/api/v1/auth/signup", json=payload)
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "conflict"

    wrong_password = backend.post(
        "/api/v1/auth/login", json={"email": email, "password": "wrong-password"}
    )
    unknown_email = backend.post(
        "/api/v1/auth/login", json={"email": unique_email("ghost"), "password": PASSWORD}
    )
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json()["error"] == unknown_email.json()["error"]


def test_protected_route_rejects_missing_and_forged_tokens(backend: httpx.Client) -> None:
    missing = backend.get("/api/v1/auth/me")
    assert missing.status_code == 401
    assert missing.headers["WWW-Authenticate"] == "Bearer"

    forged = backend.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert forged.status_code == 401


def test_refresh_rotates_and_logout_revokes(backend: httpx.Client) -> None:
    email = unique_email("rotate")
    signup = backend.post("/api/v1/auth/signup", json={"email": email, "password": PASSWORD})
    assert signup.status_code == 201
    first = signup.json()

    rotated = backend.post(
        "/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert rotated.status_code == 200
    second = rotated.json()
    assert second["refresh_token"] != first["refresh_token"]

    me = backend.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {second['access_token']}"}
    )
    assert me.status_code == 200

    # Concurrent replay is rejected without revoking the family the winner is using.
    replay = backend.post(
        "/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert replay.status_code == 401
    assert (
        backend.post(
            "/api/v1/auth/refresh", json={"refresh_token": second["refresh_token"]}
        ).status_code
        == 200
    )

    logout = backend.post(
        "/api/v1/auth/logout", json={"refresh_token": second["refresh_token"]}
    )
    assert logout.status_code == 204
    assert (
        backend.post(
            "/api/v1/auth/refresh", json={"refresh_token": second["refresh_token"]}
        ).status_code
        == 401
    )


def test_frontend_bff_creates_httponly_session(
    frontend_url: str, backend: httpx.Client
) -> None:
    email = unique_email("bff")

    with httpx.Client(base_url=frontend_url, timeout=10.0) as client:
        signup = client.post(
            "/api/auth/signup",
            json={"email": email, "password": PASSWORD, "full_name": "BFF User"},
        )

        assert signup.status_code == 201
        assert signup.json()["user"]["email"] == email
        assert "access_token" not in signup.text
        assert "refresh_token" not in signup.text

        cookies = signup.headers.get_list("set-cookie")
        assert any("nexa_access_token=" in cookie for cookie in cookies)
        assert any("nexa_refresh_token=" in cookie for cookie in cookies)
        assert all("HttpOnly" in cookie and "SameSite=lax" in cookie for cookie in cookies)

        refresh_token = client.cookies.get("nexa_refresh_token")
        assert refresh_token

        dashboard = client.get("/dashboard")
        assert dashboard.status_code == 200
        assert email in dashboard.text

        logout = client.post("/api/auth/logout")
        assert logout.status_code == 200

        protected = client.get("/dashboard", follow_redirects=False)
        assert protected.status_code == 307
        assert protected.headers["location"] == "/login"

    # Logout must revoke the server-side family, not only clear this browser's cookies.
    revoked = backend.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert revoked.status_code == 401


def test_frontend_bff_accepts_a_same_origin_signup(frontend_url: str) -> None:
    """A browser POST carries ``Origin``, so it must match the host the client addressed.

    The frontend container binds ``0.0.0.0``. When the expected origin was derived from that bind
    address instead of the ``Host`` header, every browser signup, login, refresh and logout was
    refused with ``csrf_rejected``; the browser job caught it, and this keeps the same contract
    visible to the HTTP suite, which otherwise sends no ``Origin`` at all.
    """
    origin = frontend_url
    email = unique_email("same-origin")

    with httpx.Client(base_url=frontend_url, timeout=10.0) as client:
        signup = client.post(
            "/api/auth/signup",
            json={"email": email, "password": PASSWORD, "full_name": "Same Origin User"},
            headers={"Origin": origin, "Sec-Fetch-Site": "same-origin"},
        )

        assert signup.status_code == 201, signup.text
        assert signup.json()["user"]["email"] == email
        cookies = signup.headers.get_list("set-cookie")
        assert any("nexa_access_token=" in cookie for cookie in cookies)

        # Still a CSRF defence, not an open door: a foreign Origin is refused before the API call.
        rejected = client.post(
            "/api/auth/signup",
            json={"email": unique_email("cross-origin"), "password": PASSWORD},
            headers={"Origin": "https://attacker.example", "Sec-Fetch-Site": "cross-site"},
        )
        assert rejected.status_code == 403
        assert rejected.json()["error"]["code"] == "csrf_rejected"
        assert "set-cookie" not in rejected.headers


def test_frontend_bff_signup_persists_orm_timestamps(frontend_url: str) -> None:
    """The BFF signup must store the timestamps the ORM supplies, not rely on the database.

    The SQLite stack migrates a real file, so ``users`` and ``refresh_tokens`` keep the migrations'
    PostgreSQL ``now()`` server defaults that SQLite cannot evaluate. When ``TimestampMixin``
    regressed to leaving the bookkeeping columns to the database, SQLite rejected the first insert
    with "unknown function: now()" and this route answered 500 instead of 201.

    Asserting the returned ``created_at`` is a recent time that login reads back unchanged keeps
    the failure attributed to those columns, rather than to whatever step of the flow breaks first.
    """
    email = unique_email("timestamps")

    with httpx.Client(base_url=frontend_url, timeout=10.0) as client:
        signup = client.post(
            "/api/auth/signup",
            json={"email": email, "password": PASSWORD, "full_name": "Timestamp User"},
        )
        assert signup.status_code == 201, (
            "BFF signup failed; on the SQLite stack this is the insert that rejects "
            "created_at/updated_at when TimestampMixin stops supplying them: "
            f"{signup.text}"
        )

        created_at = as_utc(signup.json()["user"]["created_at"])
        assert abs((datetime.now(tz=UTC) - created_at).total_seconds()) < 300

        # The cookie issued by signup renders the persisted profile through /auth/me.
        dashboard = client.get("/dashboard")
        assert dashboard.status_code == 200
        assert email in dashboard.text

        # Login writes another refresh_tokens row, so it depends on the same ORM defaults.
        login = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
        assert login.status_code == 200, login.text
        assert as_utc(login.json()["user"]["created_at"]) == created_at


def test_proxy_refreshes_an_expired_access_cookie(frontend_url: str) -> None:
    email = unique_email("silent")

    with httpx.Client(base_url=frontend_url, timeout=10.0) as client:
        signup = client.post(
            "/api/auth/signup",
            json={"email": email, "password": PASSWORD, "full_name": "Silent Refresh"},
        )
        assert signup.status_code == 201

        refresh_token = client.cookies.get("nexa_refresh_token")
        assert refresh_token

    # Simulate a browser holding an access token that has outlived its expiry while the refresh
    # token is still valid. The cookies are sent explicitly on a fresh client so the forged access
    # cookie cannot collide with the host-only cookie set by signup.
    dashboard = httpx.get(
        f"{frontend_url}/dashboard",
        headers={"Cookie": f"nexa_access_token=not-a-jwt; nexa_refresh_token={refresh_token}"},
        follow_redirects=False,
        timeout=10.0,
    )
    assert dashboard.status_code == 200
    assert email in dashboard.text

    set_cookies = dashboard.headers.get_list("set-cookie")
    rotated_access = next(
        (cookie for cookie in set_cookies if cookie.startswith("nexa_access_token=")), None
    )
    rotated_refresh = next(
        (cookie for cookie in set_cookies if cookie.startswith("nexa_refresh_token=")), None
    )
    assert rotated_access is not None
    assert not rotated_access.startswith("nexa_access_token=not-a-jwt")
    assert rotated_refresh is not None
    assert not rotated_refresh.startswith(f"nexa_refresh_token={refresh_token}")


def test_frontend_bff_reports_backend_auth_errors(frontend_url: str) -> None:
    with httpx.Client(base_url=frontend_url, timeout=10.0) as client:
        response = client.post(
            "/api/auth/login",
            json={"email": unique_email("missing"), "password": PASSWORD},
        )

        assert response.status_code == 401
        assert response.json()["error"]["code"] == "unauthorized"
        assert "set-cookie" not in response.headers


def test_dashboard_requires_a_session(frontend_url: str) -> None:
    response = httpx.get(f"{frontend_url}/dashboard", follow_redirects=False, timeout=10.0)

    assert response.status_code == 307
    assert response.headers["location"] == "/login"
