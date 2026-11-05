# Nexa AI — Backend

FastAPI service that exposes the Nexa AI platform API and owns persistence (PostgreSQL via
SQLAlchemy 2.0 async). See the root [README](../README.md) and
[docs/architecture.md](../docs/architecture.md) for the full picture.

## Responsibilities

| Layer | Path | Purpose |
| --- | --- | --- |
| Transport | `app/api/` | Versioned routers, dependencies, request/response wiring |
| Domain services | `app/services/` | Business logic, orchestrates repositories and infrastructure |
| Persistence | `app/models/`, `app/db/` | SQLAlchemy models, engine/session lifecycle |
| Contracts | `app/schemas/` | Pydantic v2 request/response models |
| Cross-cutting | `app/core/` | Settings, logging, security primitives, errors, middleware |

Auth-specific modules: `app/api/v1/endpoints/auth.py` (HTTP), `app/services/auth.py` (use cases),
`app/schemas/auth.py` (contracts), `app/api/deps.py#get_current_user` (bearer validation).

## Local development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env          # then edit values
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs: <http://localhost:8000/docs> · Liveness: `/health` · Readiness: `/api/v1/health`

## Authentication

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/signup` | — | Create an account (HTTP 201) |
| `POST` | `/api/v1/auth/login` | — | Exchange credentials for a token |
| `GET` | `/api/v1/auth/me` | Bearer | Current user (protected route) |

- Passwords are hashed with Argon2id (`app/core/security.py`); plaintext is never stored, logged or
  returned, and validation errors do not echo submitted passwords.
- Tokens are HS256 JWTs signed with `SECRET_KEY`, carrying `sub` (the user id), `iat`, `exp` and
  `type: access`. Lifetime comes from `ACCESS_TOKEN_EXPIRE_MINUTES`.
- Emails are validated with Pydantic `EmailStr` and normalised to lower case before storage, so
  registration and login are case-insensitive.
- Login failures are deliberately indistinguishable (unknown email, wrong password or deactivated
  account all return `401 Invalid email or password.` with `WWW-Authenticate: Bearer`); a dummy
  Argon2 verification keeps timing comparable when no account matches.
- `GET /auth/me` validates the signature, expiry and token type, then loads an active user.

```bash
curl -s -X POST localhost:8000/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct-horse-battery"}'

TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct-horse-battery"}' | jq -r .access_token)

curl -s localhost:8000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

Tests: `pytest tests/test_auth.py` covers registration, duplicate emails, hashing, token rejection
(expired, forged, malformed), deactivated accounts and password redaction.

## Quality gates

```bash
ruff check . && ruff format --check .
pytest
```
