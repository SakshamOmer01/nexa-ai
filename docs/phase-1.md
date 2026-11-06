# Phase 1 — Foundation and authentication hardening

Status as of 2026-11-06. This page is the acceptance contract for Phase 1: what the release must do,
how each requirement is verified, and which deliberately deferred features belong to Phase 2.
Phase 1 is complete when every criterion in the tables below passes on `main` using the command in
its row.

## 1. Scope

Phase 1 delivers the production-ready foundation that product work can build on:

- One monorepo with a typed Next.js web app, an async FastAPI service, a PostgreSQL schema owned by
  Alembic and an ML library workspace.
- A SQLite path for local development and tests that uses the same migrations as PostgreSQL.
- Email/password accounts, Argon2id hashing, short-lived JWT access tokens and rotating refresh
  tokens stored as digests.
- A same-origin BFF that keeps both tokens in httpOnly cookies, refreshes them silently and guards
  `/dashboard`.
- Credential-endpoint rate limiting and explicit CSRF origin checks on the BFF.
- Health probes, structured logs, fail-fast configuration, non-root images and a five-job CI
  pipeline that verifies every layer, including browser end-to-end flows.

Delivered after the initial Phase 1 acceptance run: a Playwright suite for signup, login, silent
refresh and logout, run by the SQLite CI job (criterion T7). Out of scope for Phase 1 (see §4):
deployment automation, immediate access-token revocation, distributed rate limiting, email
verification, password reset, per-device session management, multi-tenancy and observability beyond
logs/probes.

## 2. Acceptance criteria

Every row is objective: it names the artefact and the command or check that proves it. "CI" means
the job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

### 2.1 Backend and API

| ID | Requirement | Verification |
| --- | --- | --- |
| B1 | The app builds through the `create_app` factory with settings and database on `app.state`, and imports without side effects. | `cd backend && python -c "from app.main import app; print(app.title)"` |
| B2 | `/`, `/health`, `/api/v1/health` and `/api/v1/health/live` return their documented status codes; readiness degrades to `503` when the database is down. | `pytest backend/tests/test_health.py`; integration health contracts |
| B3 | Signup, login, refresh, logout and `/auth/me` match the contract in `README.md` (status codes, token pair, public user only). | `pytest backend/tests/test_auth.py backend/tests/test_refresh_tokens.py` |
| B4 | Every error uses `{"error": {"code", "detail"}, "request_id"}` and every response carries `X-Request-ID` and `X-Process-Time-Ms`. | `pytest backend/tests`; integration contracts |
| B5 | Login, signup and refresh are rate limited per identity and answer `429` with `Retry-After` in the shared error envelope. The budget and window are configurable and can be disabled. | `pytest backend/tests/test_rate_limit.py` |
| B6 | Production settings reject a placeholder/short `SECRET_KEY`, `DEBUG=true` and wildcard CORS at start-up. | `pytest backend/tests/test_config.py` |
| B7 | Ruff lint and formatting pass for the service. | `cd backend && ruff check . && ruff format --check .` |

### 2.2 Database

| ID | Requirement | Verification |
| --- | --- | --- |
| D1 | Alembic `upgrade head` applies both migrations (`0001` users, `0002` refresh_tokens) to a real PostgreSQL 17 service. | CI job `backend` → "Apply migrations to PostgreSQL" |
| D2 | The same migration files apply to a SQLite file and support signup → login → refresh → logout. | `pytest backend/tests/test_sqlite_migrations.py` (own CI step) |
| D3 | `alembic upgrade head --sql` emits the PostgreSQL DDL without a database connection. | `cd backend && alembic upgrade head --sql` |
| D4 | ORM models supply `created_at`/`updated_at` themselves so inserts work on both engines. | `pytest backend/tests/test_timestamps.py`; integration `test_frontend_bff_signup_persists_orm_timestamps` on the SQLite stack |
| D5 | `dev.db`, `.env` files and generated artifacts are git-ignored; schema changes arrive only through reviewed migrations. | `git status --porcelain` after local runs; repository review |

### 2.3 Authentication and security

| ID | Requirement | Verification |
| --- | --- | --- |
| S1 | Passwords are stored as Argon2id hashes and never appear in responses, logs or validation errors. | `pytest backend/tests/test_security.py backend/tests/test_auth.py` |
| S2 | Access and refresh tokens live only in httpOnly, SameSite=Lax cookies on the web tier; no browser-readable storage is used. | `pytest frontend/src/lib/auth/cookies.test.ts frontend/src/lib/auth/session.test.ts`; integration BFF cookies; Playwright cookie assertions |
| S3 | Refresh tokens are single-use, stored as SHA-256 digests, rotate on use, detect replay beyond the grace period and revoke the family immediately on logout. | `pytest backend/tests/test_refresh_tokens.py`; integration refresh/logout contract |
| S4 | Every state-changing BFF route (`/api/auth/login`, `/signup`, `/logout`) rejects a request whose `Origin` is not this site and whose `Sec-Fetch-Site` is not `same-origin`/`none`. | `pytest` via `frontend/src/lib/auth/csrf.test.ts`, `bff.test.ts`, logout route test |
| S5 | Credential rate limiting is enforced per account/token identity, works when the API is called by the BFF, and its single-instance scope is documented. | `pytest backend/tests/test_rate_limit.py`; §4 decision R1 |
| S6 | Access tokens are short-lived (default 30 minutes) and are not immediately revocable; logout revokes refresh tokens only. This is an explicit Phase 1 bound. | `pytest backend/tests/test_refresh_tokens.py`; §4 decision S1 |
| S7 | Both runtime images run as non-root and contain no build toolchain. | `docker compose build`; Dockerfile review |
| S8 | Secrets come from the environment; production guards and non-root containers are part of the release. | `pytest backend/tests/test_config.py`; `docker compose config` |

### 2.4 Frontend

| ID | Requirement | Verification |
| --- | --- | --- |
| F1 | All App Router routes (`/`, `/login`, `/signup`, `/dashboard`, `/api/health`, `/api/auth/*`) typecheck and build for production. | `cd frontend && npm run typecheck && npm run build` |
| F2 | The BFF sets both cookies on login/signup, returns only the public user, revokes the family and clears cookies on logout, and maps backend failures without leaking tokens. | frontend route/lib tests; integration BFF contracts |
| F3 | `src/proxy.ts` refreshes an expiring session, stores and forwards the rotated pair, and keeps an optimistic `/dashboard` guard. | `pytest` via `frontend/src/proxy.test.ts`; integration silent-refresh contract; Playwright silent-refresh flow |
| F4 | `/api/health` reports web liveness plus backend/database status and never turns a dependency outage into a web restart. | `frontend/src/app/api/health/route.test.ts`; integration health contracts |
| F5 | Frontend tests run in jsdom with Testing Library and enforce a 95% statements/branches/functions/lines coverage floor over `src/**`. | `cd frontend && npm test -- --coverage` |
| F6 | ESLint (Next config) and `tsc --noEmit` pass. | `cd frontend && npm run lint && npm run typecheck` |

### 2.5 Testing and quality

| ID | Requirement | Verification |
| --- | --- | --- |
| T1 | Backend suite passes with no failures: 70 tests across auth, refresh rotation, config, security, health, timestamps and SQLite migrations. | `cd backend && python -m pytest` |
| T2 | Frontend suite passes with no failures: 132 tests in 32 files covering every route, component, library helper and the proxy. | `cd frontend && npm test` |
| T3 | ML workspace lint, formatting and 5 tests pass. | `cd ml && ruff check . && ruff format --check . && pytest` |
| T4 | Cross-service integration suite (18 tests) passes against both the Compose stack and the SQLite process stack. | CI jobs `integration` and `sqlite`; locally `NEXA_VERIFY_INTEGRATION=1 ./scripts/verify.sh` |
| T5 | No test that is required by Phase 1 is skipped in its owning job. The Compose database-outage test skips only in the SQLite job, because it needs the Compose service, and runs in the container job with `NEXA_REQUIRE_COMPOSE_DB=1`. | CI summaries; integration health contracts |
| T6 | Coverage is measured over all source files, not only imported ones, so a new untested module lowers the score. Current total: 100% statements, 98.87% branches, 100% functions, 100% lines. | `frontend/coverage/coverage-summary.json` |
| T7 | Four Playwright/Chromium flows pass against a real stack: signup, login, dashboard rendering, silent refresh after the access cookie is invalidated, and logout that clears cookies and revokes the refresh token. | `cd frontend && npm run test:e2e`; CI job `sqlite` |

### 2.6 CI, delivery and documentation

| ID | Requirement | Verification |
| --- | --- | --- |
| C1 | CI runs five jobs on pushes to `main` and pull requests: `backend`, `frontend`, `ml`, `sqlite`, `integration`. | `.github/workflows/ci.yml`; GitHub Actions run |
| C2 | The backend job applies migrations to PostgreSQL 17, then runs the SQLite migration step, the app import and the full suite. | CI job `backend` |
| C3 | The SQLite job starts both services as processes, waits for readiness, runs the same integration suite as the container job, then runs the Playwright browser flows. | CI job `sqlite` |
| C4 | The container job builds both images with a buildx layer cache, starts the stack with `--no-build`, runs the integration suite and tears the stack down even on failure. | CI job `integration` |
| C5 | Every suite publishes a JUnit report, and the run summary lists failed/errored/skipped cases; frontend coverage and the Playwright report/traces are uploaded. | CI artifact steps and `scripts/junit-summary.py` |
| C6 | Local commands in the README and `docs/development.md` match the repository, and `make verify` states its scope instead of claiming to run every CI job. | `./scripts/verify.sh`; documentation review |
| C7 | Deployment automation is deliberately not part of Phase 1; the artefacts are deployable and verified. | §4 decision D1 |

### 2.7 Phase 1 exit checklist

- [x] B1–B7 backend and API criteria pass.
- [x] D1–D5 database criteria pass on PostgreSQL 17 and SQLite.
- [x] S1–S8 security criteria pass, including rate limiting and CSRF origin checks.
- [x] F1–F6 frontend criteria pass with the coverage gate.
- [x] T1–T7 suites, integration jobs, browser flows and coverage report pass.
- [x] C1–C7 CI, delivery and documentation criteria are implemented.
- [x] All remaining Phase 2 deferrals below are documented with reasoning.

## 3. How to verify Phase 1

```bash
./scripts/bootstrap.sh                 # once: env files, .venv, npm ci
./scripts/verify.sh                    # local gates that mirror CI

# Cross-service suite (needs a running stack: ./scripts/dev.sh or docker compose up -d)
NEXA_VERIFY_INTEGRATION=1 ./scripts/verify.sh

# Browser flows (same stack; install Chromium once)
cd frontend && npx playwright install chromium && npm run test:e2e

# CI-only gates: PostgreSQL migration apply, image builds, Compose stack, JUnit artifacts
git push origin main                   # push to the protected branch runs all five jobs
```

`make verify` is an alias for `./scripts/verify.sh`; it does not build container images or start a
stack, so it is not a substitute for the CI `integration` job.

## 4. Phase 1 vs Phase 2 decisions

| Feature | Phase | Decision and reasoning |
| --- | --- | --- |
| **Credential rate limiting** | **1** (per account/token) + 2 (distributed) | Per-identity limits are the minimum control against password guessing. The API is called by the BFF server-side, so keying on the client address would collapse every browser into the web container's IP; keying on the account email (login/signup) and token digest (refresh) works behind the BFF. Buckets are in process memory, so the budget is per API instance and resets on restart. A shared store and trusted-proxy client identity are Phase 2. |
| **CSRF origin checks** | **1** | No new infrastructure: the BFF already owns the cookies, so one guard module can reject cross-origin POSTs on all three state-changing routes. It is defence in depth on top of SameSite=Lax and directly verifiable with unit and integration tests. |
| **Immediate access-token revocation** | **2** | Would require either a per-request revocation lookup (shared cache/DB) or token versioning with a migration and invalidation of every outstanding token on logout-everywhere. The Phase 1 bound is the 30-minute access-token lifetime; refresh and logout revocation are already immediate. Deferred so the session model is designed once, with the device/session UI. |
| **Deployment automation** | **2** | There is no chosen target environment, account, secret store or rollback policy. Phase 1 delivers verified deployable artefacts (non-root images, health probes, startup ordering, cached builds). Automating a deploy before those operational decisions would bake in an environment prematurely. |
| **E2E testing** | **Delivered** | Initially deferred: Phase 1 already verified the journeys at the HTTP boundary, and browser E2E adds Playwright, browser installation and flake surface. It was added immediately after acceptance because the SQLite job already runs both services: four Chromium flows now cover hydration, rendered UI, httpOnly cookies, silent rotation and logout, reusing that stack at the cost of one browser download. |

### Phase 2 backlog (explicitly not Phase 1)

1. Distributed rate limiting with a shared store and a trusted client-IP policy, plus IP-layer
   limits for signup abuse.
2. Immediate access-token revocation (token version or denylist) and "sign out everywhere".
3. Deployment automation once the target environment, secrets and rollback process are chosen.
4. Email verification, password reset and transactional email delivery.
5. Per-device session metadata, listing/revocation API and dashboard UI.
6. Refresh-token cleanup job; the `refresh_tokens` table retains expired rows for audit.
7. Multi-tenant workspaces, API keys and OpenAPI → TypeScript client generation.
8. OpenTelemetry traces/metrics, alerting and error reporting.
9. Model registry, evaluation gates and an inference worker built on `ml/`.
