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
`app/schemas/auth.py` (contracts), `app/api/deps.py#get_current_user` (bearer validation) and
`app/models/refresh_token.py` (rotating session families).

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
| `POST` | `/api/v1/auth/login` | — | Exchange credentials for a token pair |
| `POST` | `/api/v1/auth/refresh` | Refresh token | Rotate the token pair (single use) |
| `POST` | `/api/v1/auth/logout` | Refresh token (optional) | Revoke the session family (204, idempotent) |
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
- Refresh tokens are 256-bit opaque secrets stored only as SHA-256 digests in `refresh_tokens`.
  Every login starts a family; refresh revokes the presented row and issues a successor in the same
  family. Replaying a rotated token after a 30-second concurrency grace revokes the family, and
  logout revokes it immediately. Access tokens stay stateless until they expire.

```bash
PAIR=$(curl -s -X POST localhost:8000/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct-horse-battery"}')
TOKEN=$(jq -r .access_token <<<"$PAIR")
REFRESH=$(jq -r .refresh_token <<<"$PAIR")

PAIR=$(curl -s -X POST localhost:8000/api/v1/auth/refresh \
  -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$REFRESH\"}")
TOKEN=$(jq -r .access_token <<<"$PAIR")

curl -s localhost:8000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"

curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/v1/auth/logout \
  -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$REFRESH\"}"   # 204
```

- Login, signup and refresh are rate limited per identity (account email, or token digest for
  refresh) and answer `429` with `Retry-After`; see `app/core/rate_limit.py` and the
  `AUTH_RATE_LIMIT_*` settings. Buckets are per API process.

Tests: `pytest tests/test_auth.py tests/test_refresh_tokens.py` covers registration, duplicate
emails, hashing, token rejection (expired, forged, malformed), deactivated accounts, rotation,
concurrency grace, replay revocation, logout and password/token redaction.
`tests/test_rate_limit.py` covers the credential-endpoint budget and its error contract.

## Quality gates

```bash
ruff check . && ruff format --check .
pytest
pytest tests/test_sqlite_migrations.py   # real migrations + auth flow on SQLite
```
