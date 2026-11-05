# Roadmap and known gaps

Status as of 2026-11-05. This page is the detailed version of the README roadmap: what is shipped and
verified, what is explicitly not built yet, and the smaller gaps found while auditing the
implementation. Nothing here is a promise of a date — it records the current boundary of the
codebase so features are added deliberately.

## Shipped

| Area | What exists | Where |
| --- | --- | --- |
| Monorepo foundation | Typed Next.js app, async FastAPI service, PostgreSQL + Alembic, ML library package | `frontend/`, `backend/`, `ml/` |
| Health and observability | Liveness + dependency-aware readiness per service, request ids, structured JSON logs | `backend/app/services/health.py`, `frontend/src/app/api/health/route.ts` |
| Accounts | Email/password signup and login, Argon2id hashing, case-insensitive unique emails | `backend/app/services/auth.py` |
| Access tokens | HS256 JWT with `sub`/`iat`/`exp`/`type`, validated by `get_current_user` | `backend/app/core/security.py`, `backend/app/api/deps.py` |
| Sessions | Rotating opaque refresh tokens, SHA-256 digest storage, one family per login, replay detection, revocation on logout | `backend/app/services/auth.py`, `backend/app/models/refresh_token.py` |
| Web session | Same-origin BFF with httpOnly cookies, silent refresh in the proxy, optimistic `/dashboard` guard | `frontend/src/lib/auth/`, `frontend/src/proxy.ts` |
| Database migrations | `0001` users, `0002` refresh_tokens, applied by the API container before serving | `backend/alembic/versions/` |
| Containers | Multi-stage, non-root images with health checks and compose health-condition ordering | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` |
| CI | Lint, tests, migration apply against PostgreSQL 17, ML tests, production build, cached image builds, compose stack and cross-service tests | `.github/workflows/ci.yml` |
| Build caching | Dependency/source layer split, BuildKit cache mounts (pip, npm, Turbopack) and GitHub Actions layer cache scoped per image | Dockerfiles + `ci.yml` |

## Not implemented yet

These are deliberately absent; do not assume any of them works because a session exists.

### Per-device session management

Implemented today: **one refresh-token family per login**. Each successful login (or signup) creates a
new `family_id`, and logout/replay revocation affects only that family, so two browsers are already
independent sessions in the security sense.

Not implemented:

- No device metadata is stored. `refresh_tokens` has no `user_agent`, `user_agent_hash`, `ip`,
  `label`, `last_used_at` or `last_seen` column, and no migration adds them.
- No session listing or targeted revocation API. The only revocation paths are
  `POST /auth/logout` (revokes the family identified by the presented refresh token) and replay
  detection; there is no `GET /auth/sessions` or `DELETE /auth/sessions/{id}`.
- No UI. `/dashboard` shows the current session's characteristics, not a list of active sessions.
- No "sign out everywhere" action for the current user.

Building this needs migration `0003` (device/last-seen columns), two endpoints scoped to
`user_id = current_user.id`, and a dashboard panel. Until then, the family id plus timestamps are the
only server-side session identity.

### Authentication hardening

- **Rate limiting** on `/auth/login` and `/auth/refresh` — no limiter, middleware or lockout exists;
  Argon2id cost and constant-time failure behaviour are the only mitigations.
- **Email verification** — accounts are usable immediately; there is no `email_verified` column or
  verification flow.
- **Password reset / change** — no endpoint, token table or email delivery.
- **Access-token revocation on logout** — access JWTs stay stateless until `exp` (bounded by
  `ACCESS_TOKEN_EXPIRE_MINUTES`); only refresh tokens are revoked immediately.
- **Refresh-token cleanup** — expired and revoked rows are retained for audit; no scheduled job
  prunes them.
- **BFF CSRF defence** — the `/api/auth/*` route handlers rely on `SameSite=Lax` cookies alone; an
  explicit `Origin`/`Sec-Fetch-Site` check is not implemented.

### Platform features

- Multi-tenant workspaces, memberships and role checks (no models, no endpoints).
- API keys for machine-to-machine access.
- OpenAPI → TypeScript client generation; `frontend/src/types/api.ts` is maintained by hand.
- OpenTelemetry traces/metrics, alerting, and error reporting.
- Background jobs / queue for ingestion and long-running inference.
- Model registry, evaluation gates and an inference service in `ml/` — the package currently ships
  the `Pipeline` contract, an `EchoPipeline` reference implementation and the registry only.
- Deployment automation. CI builds and verifies images but no workflow publishes or deploys them.

### Test coverage gaps

- Frontend has lint, typecheck, production build and cross-service integration coverage, but no
  component or end-to-end test suite.
- Backend unit tests run on SQLite; PostgreSQL-specific behaviour is covered by applying migrations
  to a real PostgreSQL 17 service in CI, not by the pytest suite itself.
- `backend/app/services/health.py` always labels the database dependency `postgresql`, including the
  SQLite configuration used by tests.

## Next up (suggested order)

1. Login/refresh rate limiting and cookie-scoped CSRF checks — smallest security wins.
2. Session device metadata + `GET`/`DELETE` session endpoints and a dashboard panel.
3. Email verification and password reset (needs an email provider).
4. Multi-tenant workspaces and API keys.
5. OpenTelemetry traces/metrics and readiness alerting.
6. Model registry, evaluation gates and an inference worker built on `ml/`.
