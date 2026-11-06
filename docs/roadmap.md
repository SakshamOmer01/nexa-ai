# Roadmap and known gaps

Status as of 2026-11-06. Phase 1 (the production-ready foundation and authentication hardening) is
complete; its acceptance contract lives in [docs/phase-1.md](phase-1.md). This page records what is
shipped and verified, what is deliberately deferred to Phase 2, and the smaller gaps found while
auditing the implementation. Nothing here is a promise of a date — it records the current boundary
of the codebase so features are added deliberately.

## Phase 1 — completed and verified

| Area | What exists | Where |
| --- | --- | --- |
| Monorepo foundation | Typed Next.js app, async FastAPI service, PostgreSQL + Alembic, ML library package | `frontend/`, `backend/`, `ml/` |
| Local SQLite path | The same Alembic migrations and auth flow against a SQLite file, no Docker or PostgreSQL required | `backend/tests/test_sqlite_migrations.py`, CI job `sqlite` |
| Health and observability | Liveness + dependency-aware readiness per service, request ids, structured JSON logs | `backend/app/services/health.py`, `frontend/src/app/api/health/route.ts` |
| Accounts | Email/password signup and login, Argon2id hashing, case-insensitive unique emails | `backend/app/services/auth.py` |
| Access tokens | HS256 JWT with `sub`/`iat`/`exp`/`type`, validated by `get_current_user` | `backend/app/core/security.py`, `backend/app/api/deps.py` |
| Sessions | Rotating opaque refresh tokens, SHA-256 digest storage, one family per login, replay detection, revocation on logout | `backend/app/services/auth.py`, `backend/app/models/refresh_token.py` |
| Credential rate limiting | Per-account (login/signup) and per-token-digest (refresh) fixed windows, `429` + `Retry-After`, configurable and disableable, in process memory | `backend/app/core/rate_limit.py`, `backend/app/api/deps.py` |
| CSRF hardening | Every state-changing BFF route rejects a mismatched `Origin` and a non-same-origin `Sec-Fetch-Site` | `frontend/src/lib/auth/csrf.ts`, `frontend/src/lib/auth/bff.ts` |
| Web session | Same-origin BFF with httpOnly cookies, silent refresh in the proxy, optimistic `/dashboard` guard | `frontend/src/lib/auth/`, `frontend/src/proxy.ts` |
| Browser E2E | Playwright/Chromium drives signup, login, dashboard, silent refresh and logout against the real SQLite and Compose stacks in CI | `frontend/e2e/`, `frontend/playwright.config.ts` |
| Database migrations | `0001` users, `0002` refresh_tokens, applied by the API container before serving and by CI against PostgreSQL 17 and SQLite | `backend/alembic/versions/` |
| Containers | Multi-stage, non-root images with health checks and compose health-condition ordering | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` |
| CI | Five jobs: backend (PG + SQLite step), frontend (tests + coverage), ML, SQLite process stack + browser E2E, Compose stack + browser E2E; JUnit artifacts and run summaries | `.github/workflows/ci.yml` |
| Build caching | Dependency/source layer split, BuildKit cache mounts (pip, npm, Turbopack) and GitHub Actions layer cache scoped per image | Dockerfiles + `ci.yml` |
| Documentation | README, architecture, development guide, Phase 1 acceptance criteria, three ADRs | `README.md`, `docs/` |

## Verification coverage today

The foundation is covered at the HTTP/component boundary, not only at unit level. Exact counts from
the current `main`:

| Suite | Tests | What it proves |
| --- | --- | --- |
| Backend (`pytest backend/tests`) | 70 | Auth contracts, refresh rotation/replay/logout, config guards, security helpers, health/readiness, timestamps, rate limiting, SQLite migrations |
| Frontend (`npm test`) | 132 in 32 files | Every App Router page and route handler, all UI components, API client, env validation, cookie/session helpers, BFF credential and CSRF behaviour, and `proxy.ts` |
| ML workspace | 5 | Pipeline contract and registry |
| Cross-service integration | 18 | Running-stack API, BFF cookies, silent refresh, dashboard redirect, readiness degradation; run twice in CI (Compose and SQLite) |
| Browser E2E (`npm run test:e2e`) | 7 | Real Chromium: signup, login, wrong password, duplicate signup, cross-origin auth rejection, silent refresh with an invalidated access cookie, logout + server-side revocation; run twice in CI (Compose and SQLite) |
| **Total** | **232** | — |

Frontend coverage is measured over all of `src/**` and gated at 95% statements, branches, functions
and lines. Current totals: **100% statements, 98.87% branches, 100% functions, 100% lines**. The
coverage report is uploaded by CI.

This replaces the earlier claim that the frontend had no component tests: it now has 132 of them,
covering every route and component. The frontend tests live next to the code they cover
(`src/**/*.test.ts(x)`), not in a separate `__tests__` tree.

### Browser coverage

The browser gap is closed: `frontend/e2e/auth.spec.ts` drives Chromium through the rendered UI and
JavaScript hydration. It asserts httpOnly cookies after signup, account login, silent rotation when
the access cookie is stale, and logout that both clears cookies and makes the old refresh token
unusable. The SQLite CI job reuses its running services, downloads Chromium once per lockfile and
runs this suite after the cross-service tests. The suite uses `localhost` because the BFF compares
`Origin` with Next's canonical request origin.

## Phase 2 — pending

These are deliberately absent; do not assume any of them works because Phase 1 is complete.

### 1. Distributed rate limiting and client-IP policy

Implemented today: **per-identity fixed windows in process memory**. Login and signup are keyed on
the normalised account email; refresh is keyed on the SHA-256 digest of the presented token. That
works behind the BFF, where every browser shares the web container's address, and blunts password
guessing against one account.

Not implemented:

- No shared store, so each API replica has its own budget and a restart resets it. A real
  deployment needs Redis or a database-backed counter.
- No IP-layer limit, so an attacker can spread attempts across many accounts. Signup abuse is
  likewise not limited per address.
- No trusted-proxy client-identity policy for deployments that sit behind a load balancer.

### 2. Immediate access-token revocation

Access JWTs remain stateless until `exp` (default 30 minutes). Logout revokes the refresh-token
family immediately, so no new access token can be minted, but an access token already issued keeps
working until it expires. "Sign out everywhere" and immediate access-token invalidation need a token
version column or a shared denylist, and are Phase 2 work.

### 3. Deployment automation

CI builds and verifies the images, but no workflow publishes or deploys them. Phase 1 stops at
verified deployable artefacts because no target environment, secret store, migration-runner policy or
rollback process has been chosen. Deployment automation is Phase 2.

### 4. Authentication features

- **Email verification** — accounts are usable immediately; there is no `email_verified` column or
  verification flow.
- **Password reset / change** — no endpoint, token table or email delivery.
- **Refresh-token cleanup** — expired and revoked rows are retained for audit; no scheduled job
  prunes them.

### 5. Per-device session management

Implemented today: **one refresh-token family per login**. Each successful login (or signup) creates a
new `family_id`, and logout/replay revocation affects only that family, so two browsers are already
independent sessions in the security sense.

Not implemented:

- No device metadata. `refresh_tokens` has no `user_agent`, `ip`, `label`, `last_used_at` or
  `last_seen` column, and no migration adds them.
- No session listing or targeted revocation API. The only revocation paths are `POST /auth/logout`
  (revokes the family identified by the presented refresh token) and replay detection; there is no
  `GET /auth/sessions` or `DELETE /auth/sessions/{id}`.
- No UI. `/dashboard` shows the current session's characteristics, not a list of active sessions.
- No "sign out everywhere" action.

Building this needs migration `0003` (device/last-seen columns), two endpoints scoped to
`user_id = current_user.id`, and a dashboard panel. Until then, the family id plus timestamps are the
only server-side session identity.

### 6. Platform features

- Multi-tenant workspaces, memberships and role checks (no models, no endpoints).
- API keys for machine-to-machine access.
- OpenAPI → TypeScript client generation; `frontend/src/types/api.ts` is maintained by hand.
- OpenTelemetry traces/metrics, alerting, and error reporting.
- Background jobs / queue for ingestion and long-running inference.
- Model registry, evaluation gates and an inference service in `ml/` — the package currently ships
  the `Pipeline` contract, an `EchoPipeline` reference implementation and the registry only.

## Known smaller gaps

- `backend/app/services/health.py` always labels the database dependency `postgresql`, including the
  SQLite configuration used by tests and local development.
- Backend unit tests run on SQLite; PostgreSQL-specific behaviour is covered by applying migrations
  to a real PostgreSQL 17 service in CI, not by the pytest suite itself.
- The Compose database-outage test skips in the SQLite job by design and runs only in the container
  job (`NEXA_REQUIRE_COMPOSE_DB=1` enforces it there).

## Suggested Phase 2 order

1. Distributed rate limiting (shared store + trusted client identity).
2. Immediate access-token revocation and "sign out everywhere".
3. Device metadata + session endpoints and dashboard panel.
4. Email verification and password reset (needs an email provider).
5. Deployment automation once the target and rollback process are chosen.
6. Multi-tenant workspaces and API keys.
7. OpenTelemetry traces/metrics and readiness alerting.
8. Model registry, evaluation gates, inference worker and refresh-token cleanup.
