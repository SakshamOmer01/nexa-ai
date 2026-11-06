# Development guide

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22 LTS or newer | `npm` 10+ (lockfile is npm) |
| Python | 3.11 or newer | 3.12 recommended |
| Docker + Compose | Compose v2 | Optional for local dev, required for the full stack |
| PostgreSQL | 17 | Only if you do not use the Compose database or the SQLite option below |

## 1. Bootstrap

```bash
cp .env.example .env                 # compose-level values
./scripts/bootstrap.sh               # creates .venv, backend/.env, frontend/.env.local, installs deps
```

`bootstrap.sh` is idempotent and never overwrites existing env files.

## 2. Configuration

| File | Used by | Commit? |
| --- | --- | --- |
| `.env` | docker compose | No |
| `backend/.env` | FastAPI, Alembic | No |
| `frontend/.env.local` | Next.js | No |
| `ml/.env` | ML scripts | No |

`*.env.example` files are the contract: when you add a variable, document it there and in this
guide. Generate a real secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Frontend `NEXT_PUBLIC_*` values are inlined into the browser bundle at build time — never put a
secret behind that prefix. Server-side code reads `API_INTERNAL_URL` instead of the public URL.

Authentication settings:

- `SECRET_KEY` signs JWTs. Rotating it immediately invalidates every access token.
- `ACCESS_TOKEN_EXPIRE_MINUTES` controls the access-token and access-cookie lifetime.
- `REFRESH_TOKEN_EXPIRE_DAYS` controls how long a session family can be refreshed; logout or replay
  detection revokes it earlier.
- The web tier marks both session cookies `Secure` when `NEXT_PUBLIC_SITE_URL` starts with `https`.
  Keep it on `http://localhost:3000` for local development so the cookies are accepted over http.
- Signup requires a password of 8–128 characters; emails are stored lower-cased.

## 3. Run everything

```bash
./scripts/dev.sh
```

This starts PostgreSQL (when Docker is available), applies migrations, then runs:

- API + interactive docs → <http://localhost:8000/docs>
- Web app → <http://localhost:3000>

Or run the whole stack in containers:

```bash
docker compose up --build
# API: http://localhost:8000/health   Web: http://localhost:3000
```

#### Docker build cache

Both Dockerfiles rely on BuildKit layer caching plus cache mounts:

- `backend/Dockerfile` installs the `pyproject.toml` dependencies in their own layer (before `app/`
  is copied) and then installs the package with `--no-deps`, so editing code does not reinstall
  FastAPI/SQLAlchemy. The pip cache mount keeps wheels between builds.
- `frontend/Dockerfile` copies `package.json` + `package-lock.json` into a `deps` stage, so `npm ci`
  is reused until the lockfile changes; the Turbopack `.next/cache` directory is a cache mount, which
  makes a rebuild after a source change incremental instead of a full compile.
- Cache mounts are not part of the image and are not shared between machines; CI gets cross-run
  reuse from the GitHub Actions layer cache instead (see `.github/workflows/ci.yml`).
- Images are tagged `nexa-ai-backend:local` / `nexa-ai-frontend:local`, so CI builds once and runs
  `docker compose up -d --no-build`. Locally, `docker compose build` (or `up --build`) still builds
  and tags the same names.

BuildKit is the default in Docker Engine 23+ and Docker Desktop. On an older engine, export
`DOCKER_BUILDKIT=1`.

### Try authentication

```bash
# API directly
PAIR=$(curl -s -X POST localhost:8000/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct-horse-battery"}')
REFRESH=$(jq -r .refresh_token <<<"$PAIR")

# Rotate it (the old token stops working)
curl -s -X POST localhost:8000/api/v1/auth/refresh \
  -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$REFRESH\"}" | jq

# Revoke the session family
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/v1/auth/logout \
  -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$REFRESH\"}"

# Or use the app: http://localhost:3000/signup → /dashboard
```

The browser flow goes through `/api/auth/signup` and `/api/auth/login`, which store both tokens in
httpOnly cookies and return only the public user. `src/proxy.ts` refreshes an expired access cookie
before rendering, so staying signed in past `ACCESS_TOKEN_EXPIRE_MINUTES` does not require a reload
or re-login. Open `/dashboard` while signed out to see the redirect to `/login`.

### Run services individually

```bash
# Backend
cd backend
../.venv/bin/alembic upgrade head
../.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
```

### Run without PostgreSQL (SQLite)

The API only needs an async SQLAlchemy URL, so a SQLite file is enough for local work on auth,
sessions and the health probes, with no database service and no Docker:

```bash
cd backend
export DATABASE_URL="sqlite+aiosqlite:///./dev.db"
export SECRET_KEY="dev-only-insecure-secret-change-me"   # any 32+ character value works locally
../.venv/bin/alembic upgrade head
../.venv/bin/uvicorn app.main:app --reload --port 8000
```

To carry this across shells, point `DATABASE_URL` in `backend/.env` at the file; `bootstrap.sh`
already copied a `SECRET_KEY` there from the template. The frontend does not change: start it with
`API_INTERNAL_URL=http://localhost:8000/api/v1` in `frontend/.env.local` so the BFF routes and
`/api/health` reach this API.

These are the migrations from section 4, unchanged — nothing is skipped. Their DDL is written for
PostgreSQL (for example the `now()` server defaults), so the ORM fills `created_at` and
`updated_at` itself, and inserts and updates work on either engine.
`backend/tests/test_sqlite_migrations.py` applies the real migrations to a temporary SQLite file
and drives signup → login → refresh → logout against it; CI runs that file as its own step, so
the local-development path fails the build instead of a laptop if it breaks.

Development only:

- SQLite stores timestamps without a UTC offset and has none of PostgreSQL's concurrency, types or
  operators. Anything that depends on them (JSON queries, arrays, `ON CONFLICT` behaviour,
  concurrent writers) still has to be checked on the Compose stack.
- `dev.db` is a throwaway artifact and is git-ignored; delete it to start from an empty database.

## 4. Database migrations

```bash
cd backend
../.venv/bin/alembic revision --autogenerate -m "add workspace table"
../.venv/bin/alembic upgrade head
../.venv/bin/alembic downgrade -1
```

- Review every autogenerated migration; Alembic cannot infer data backfills or some type changes.
- The URL always comes from settings, so migrations and the API cannot diverge, and the same
  commands apply to whatever `DATABASE_URL` names — including the SQLite file from section 3.
- Run `alembic upgrade head --sql` to inspect the emitted PostgreSQL DDL without a database.

## 5. Tests

```bash
# Backend unit/contract tests (no database required — in-memory SQLite)
cd backend && ../.venv/bin/python -m pytest

# Auth only — access tokens, web session and refresh-token rotation
cd backend && ../.venv/bin/python -m pytest tests/test_auth.py tests/test_refresh_tokens.py

# SQLite local-development path — real migrations plus the auth flow (own CI step)
cd backend && ../.venv/bin/python -m pytest tests/test_sqlite_migrations.py

# ML workspace
cd ml && ../.venv/bin/python -m pytest

# Frontend component tests (Vitest + Testing Library, jsdom)
cd frontend && npm test

# Cross-service integration tests (requires a running stack)
./scripts/dev.sh                     # or: docker compose up -d
python -m pip install -r tests/requirements.txt
pytest tests -q
```

Integration tests target `NEXA_BACKEND_URL` / `NEXA_FRONTEND_URL` (defaults `localhost:8000` and
`localhost:3000`) and wait up to `NEXA_STARTUP_TIMEOUT` seconds for readiness.
`tests/integration/test_auth_contracts.py` covers the full loop against the running stack: API
signup/login/refresh/logout, the BFF's httpOnly cookies, silent refresh in `proxy.ts` and the
signed-out `/dashboard` redirect.

`tests/integration/test_health_contracts.py` also proves readiness fails closed: it stops the
compose `db` service, waits for `/api/v1/health` to answer `503` with `postgresql: down`, then
starts the service again and waits for readiness to return to `200`. It is skipped when the stack
is not managed by Docker Compose (for example a bare PostgreSQL on `localhost:5432`), because the
test has no way to stop and restart that database. Set `NEXA_REQUIRE_COMPOSE_DB=1` to turn that
skip into a failure; CI sets it so a green pipeline proves the outage path actually ran.

CI also runs this suite against a SQLite-backed stack (`SQLite stack — services + integration
tests`): the migrations, both services started as processes and the same tests, so the BFF and proxy
paths are covered without Docker. The compose-only outage test skips there, and the container job
keeps proving it.

CI runs every suite with a JUnit reporter and publishes each report as an artifact
(`backend-test-results`, `ml-test-results`, `frontend-test-results`, `integration-test-results`,
`sqlite-integration-test-results`), then renders any failed, errored or skipped cases into the
job's run summary, so per-test outcomes are readable without access to job logs.

Frontend tests are Vitest suites (`vitest.config.mts`, jsdom, Testing Library), running next to the
code they cover:

- Components — `Button` (variants, sizes, `asChild`, disabled clicks), `Badge` (variants,
  `asChild`), `Card`/`Separator` (slots, size, decorative vs announced rules), `AuthForm`
  (login/signup payloads, API error detail, unreachable server), `AuthNav` (signed-in vs
  signed-out chrome), `SignOutButton` (logout request, pending state, redirect), `AuthShell` (page
  frame and slots), `SiteHeader` (brand, nav, auth slot, external links), `SiteFooter` (links and
  version), `HealthStatusPanel` (loading state, healthy rows, unhealthy response, refresh) and the
  landing sections `Hero`/`Stack`/`Architecture` (copy, CTAs and config-driven content).
- Library helpers — `api-client` (URL resolution and slash handling, `no-store`, header merging,
  typed `ApiClientError`, void requests, health fallback), `env` (trimming, `apiOrigin`, fail-fast
  validation), `auth/cookies` (cookie hardening, `Secure` over https, JWT expiry skew),
  `auth/session` (token cookies, `/auth/me` lookup, graceful signed-out fallback), `auth/bff`
  (status codes, token storage, backend error mapping) and `cn` (class merging).
- Middleware — `proxy.ts` drives real `NextRequest` objects: no refresh while the access token is
  fresh, rotation of an expiring session (new cookies stored *and* forwarded to the current render
  without dropping unrelated cookies), cookies kept when a refresh fails, optimistic
  `/dashboard` protection, and the matcher's API/static-asset exclusions.
- Route handlers — `api/auth/login` and `api/auth/signup` delegate to the shared credential proxy
  with the right backend path and return its response untouched; `api/auth/logout` revokes the
  session family with a 5 s timeout, skips the round trip without a refresh token, and still clears
  the cookies when the backend is unreachable; `api/health` reports `ok`/`degraded`, folds backend
  dependencies in, and keeps a 200 with `no-store` while the backend is down.

`npm test` runs them; CI adds `--reporter=junit --outputFile=test-results.xml` so the report can be
published.

## 6. Verify before pushing

```bash
./scripts/verify.sh
```

Runs the same gates as CI: ruff lint/format, backend + ML tests, PostgreSQL migration SQL
generation, ESLint, TypeScript, frontend tests, the production build and `docker compose config`.

## 7. Frontend notes

- `next typegen` runs as part of `npm run typecheck`; Next.js generates route types and
  `next-env.d.ts` (both are build artifacts and git-ignored).
- `output: "standalone"` is enabled for the Docker image. `next start` still works but warns about
  it; the container runs `node server.js` from the standalone bundle.
- Tailwind v4 has no `tailwind.config.js`: tokens live in `src/app/globals.css`.
- `vitest.config.mts` repeats the `@/*` alias from `tsconfig.json` and loads `vitest.setup.ts`, which
  registers the jest-dom matchers and unmounts trees between tests. Tests stub `fetch`,
  `next/navigation` and env vars per file, so no component needs a running backend.
- The browser renderer cannot await async server components, so `AuthNav` tests call it and render
  the resolved tree, while tests for panels that embed it (`SiteHeader`, `AuthShell`) replace it
  with a stub.

## 8. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `503` with `"status":"degraded"` on `/api/v1/health` | PostgreSQL is unreachable. Check `docker compose ps db` and `DATABASE_URL`. |
| `500` with `no such table: users` | The database in `DATABASE_URL` has no schema yet. Run `../.venv/bin/alembic upgrade head` against it. |
| `async driver` validation error at start-up | `DATABASE_URL` must use an async driver: `postgresql+asyncpg://` or `sqlite+aiosqlite://` (section 3). |
| CORS error in the browser | Add the exact origin to `CORS_ORIGINS` (scheme + host + port). |
| Frontend health shows `backend-api: down` | `API_INTERNAL_URL` (Docker) or the backend process is unreachable. |
| `port is already allocated` | Another stack is running: `docker compose down` or change `*_PORT` values in `.env`. |
| Compose starts an old image after a Dockerfile change | The `nexa-ai-*:local` tags persist. Rebuild with `docker compose build` (or `up --build`); `--no-build` deliberately never compiles. |
| `docker compose build` ignores a `RUN --mount=type=cache` line | BuildKit is disabled. Export `DOCKER_BUILDKIT=1`; the legacy builder does not support cache mounts. |
| `ModuleNotFoundError: app` | Use the venv binaries (`../.venv/bin/...`) or activate `.venv`. |
| Production start fails with a secret error | Set a unique `SECRET_KEY` of 32+ characters and `DEBUG=false`. |
| `401` from `/api/v1/auth/me` | The token is missing, expired, signed with another key, or the account is inactive. Sign in again. |
| `401` from `/api/v1/auth/refresh` | The refresh token expired, was revoked, or was replayed after rotation. Sign in again. |
| Signed out unexpectedly in two tabs | A replayed refresh token age exceeded the 30-second concurrency grace and revoked the family. Sign in again. |
| Signed in, but the header shows “Sign in” | The web tier could not reach the API (`API_INTERNAL_URL`) so the session lookup returned nothing. Check the web logs. |
| Cookie not set after login | The cookie is `Secure` when `NEXT_PUBLIC_SITE_URL` is https; browsing that build over http drops it. Use https or an http site URL locally. |
| `409` on signup | The email is already registered; use `/login` instead. |

## 9. Conventions

- Python: ruff (line length 100), typed public functions, services in `app/services`.
- TypeScript: strict mode, no `any` in public helpers, client components only when interaction
  requires it.
- Commits: imperative subject, scope when useful (`feat: initialize Nexa AI architecture`).
- Never commit `.env` files, credentials or generated artifacts.
