"""Authentication contract tests for a running stack.

These exercise the real HTTP boundaries: the FastAPI bearer-token endpoints and the Next.js BFF
that turns a token into an httpOnly session cookie.
"""

from __future__ import annotations

import uuid

import httpx

PASSWORD = "integration-password-123"


def unique_email(prefix: str = "integration") -> str:
    return f"{prefix}-{uuid.uuid4().hex}@example.com"


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


def test_frontend_bff_creates_httponly_session(frontend_url: str) -> None:
    email = unique_email("bff")

    with httpx.Client(base_url=frontend_url, timeout=10.0) as client:
        signup = client.post(
            "/api/auth/signup",
            json={"email": email, "password": PASSWORD, "full_name": "BFF User"},
        )

        assert signup.status_code == 201
        assert signup.json()["user"]["email"] == email
        assert "access_token" not in signup.text

        cookie = signup.headers.get("set-cookie", "")
        assert "nexa_access_token=" in cookie
        assert "HttpOnly" in cookie
        assert "SameSite=lax" in cookie

        dashboard = client.get("/dashboard")
        assert dashboard.status_code == 200
        assert email in dashboard.text

        logout = client.post("/api/auth/logout")
        assert logout.status_code == 200

        protected = client.get("/dashboard", follow_redirects=False)
        assert protected.status_code == 307
        assert protected.headers["location"] == "/login"


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
