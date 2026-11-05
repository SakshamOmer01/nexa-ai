# Architecture

## Goals

| Goal | How the foundation delivers it |
| --- | --- |
| Ship features without re-deciding infrastructure | One opinionated monorepo with working deploys, CI and health probes |
| Keep layers swappable | Typed contracts at each boundary; no layer imports another's internals |
| Fail fast on misconfiguration | Settings are validated at start-up, including production safety guards |
| Operate it safely | Non-root containers, readiness/liveness separation, correlation ids, structured logs |
| Grow without a rewrite | Stateless API processes, pooled async DB access, migrations, an isolated ML workspace |

## System view

```
                       ┌────────────────────────────────────────────┐
                       │                Browser                     │
                       └───────────────┬────────────────────────────┘
                                       │ HTTPS
                       ┌───────────────▼────────────────────────────┐
                       │  frontend/ — Next.js 16 (App Router, RSC)  │
                       │  • UI composition (shadcn/ui, Tailwind v4) │
                       │  • typed env + API client                  │
                       │  • /api/health  (web + dependency status)  │
                       └───────────────┬────────────────────────────┘
                                       │ server-side fetch
                                       │ NEXT_PUBLIC_API_URL (browser)
                                       │ API_INTERNAL_URL (server, private network)
                       ┌───────────────▼────────────────────────────┐
                       │  backend/ — FastAPI (async)                │
                       │  • /api/v1/* versioned routers             │
                       │  • schemas → services → models             │
                       │  • /health, /api/v1/health, /docs          │
                       └───────────────┬────────────────────────────┘
                                       │ SQLAlchemy 2.0 async (asyncpg)
                       ┌───────────────▼────────────────────────────┐
                       │  PostgreSQL 17 (single writer, pooled)     │
                       │  Alembic-owned schema in app/models        │
                       └────────────────────────────────────────────┘

  ml/ — library workspace (pipeline contracts + registry) consumed by training jobs and
        inference workers; intentionally not a long-running service in this foundation.
```

## Layers

### Frontend (`frontend/`)

- **Routing/rendering** — App Router, React Server Components by default. `src/app/page.tsx`
  composes sections; only interactive pieces are client components.
- **Design system** — shadcn/ui primitives in `src/components/ui`, design tokens in
  `src/app/globals.css` (Tailwind v4 CSS-first config).
- **Contracts** — `src/types/api.ts` mirrors backend schemas; `src/lib/api-client.ts` is the only
  place that knows how to talk to the API (timeout, error envelope, base URL selection).
- **Authentication** — `/api/auth/*` route handlers are a same-origin BFF: they call the API and
  store the access token in an httpOnly, SameSite=Lax cookie (`src/lib/auth/session.ts`). Server
  components read that cookie to render the header's signed-in state and the `/dashboard` page;
  `src/proxy.ts` performs the optimistic redirect for missing sessions. Browser JavaScript never
  receives the token, and no token is written to `localStorage`."
- **Health** — `src/app/api/health/route.ts` reports web liveness plus backend and database status.
  It always returns HTTP 200 while the web process runs so a backend outage does not restart the
  web containers.

### Backend (`backend/`)

| Path | Responsibility | Rule |
| --- | --- | --- |
| `app/api/` | HTTP surface: routers, dependencies | No business logic; no direct ORM queries |
| `app/services/` | Use cases, orchestration | Receives a session, returns schemas |
| `app/models/` | SQLAlchemy mappings | No imports from `api/` |
| `app/schemas/` | Pydantic v2 contracts | Public request/response shapes |
| `app/core/` | Config, logging, security, errors, middleware | Framework-agnostic where possible |
| `app/db/` | Engine/session lifecycle, declarative base | Owns pooling and migrations target |

Request flow: `middleware → router → dependency (settings, session) → service → model/DB → schema`.
Errors are normalised into `{"error": {"code", "detail"}, "request_id"}` so clients branch on codes.

### ML workspace (`ml/`)

A library, not a deployable. It defines `Pipeline`, `PredictionRequest`, `PredictionResult` and a
registry. Services that train or serve models depend on this package so inference interfaces do not
drift from platform conventions. Heavy frameworks belong to the worker image, not this package.

## Data

- **PostgreSQL** is the source of truth. Connection URLs must use the async driver
  (`postgresql+asyncpg://`).
- **SQLAlchemy 2.0** typed mappings (`Mapped[...]`) with a naming convention for deterministic
  constraint names, so migrations stay reviewable.
- **Alembic** owns the schema; the container entrypoint runs `alembic upgrade head` before serving.
  In production, run migrations as a separate job and keep app replicas read-mostly at boot.
- UUID primary keys are generated application-side, which keeps models portable (tests run on
  SQLite) and avoids a database round trip before insert.

## Configuration

Settings are typed (`backend/app/core/config.py`, `frontend/src/lib/env.ts`) and read from the
environment with `.env` files for local development only.

- Backend: `SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, pool sizes, log level.
- Frontend: `NEXT_PUBLIC_*` (inlined at build time) and the server-only `API_INTERNAL_URL`.
- Production guards: placeholder secrets, `DEBUG=true`, wildcard CORS and non-HTTPS origins are
  rejected when `ENVIRONMENT=production`.

## Observability

- JSON logs in containers, human-readable logs when `DEBUG=true`.
- Every request gets an `X-Request-ID` (inbound ids are accepted only if they match
  `[A-Za-z0-9._-]{1,128}` to prevent log injection) and `X-Process-Time-Ms`.
- Health endpoints: liveness never touches I/O; readiness checks PostgreSQL and returns 503 when it
  is unavailable, so orchestrators stop routing traffic instead of serving errors.

## Authentication

Email/password accounts, backed by the `users` table:

```
Browser ──POST /api/auth/login──▶ Next.js BFF ──POST /api/v1/auth/login──▶ FastAPI
   ▲                                   │                                   │
   └── httpOnly cookie ◀───────────────┘                        Argon2id verify + JWT

Server Component ──cookie──▶ GET /api/v1/auth/me (Authorization: Bearer …) ──▶ FastAPI
```

Rules:

| Concern | Decision |
| --- | --- |
| Password storage | Argon2id via `pwdlib`, one hash per password, verified in constant-ish time |
| Token | HS256 JWT with `sub`, `iat`, `exp`, `type: access`; lifetime from settings |
| Token transport | httpOnly, SameSite=Lax cookie owned by the web tier; `Secure` when the site URL is https |
| Validation | `get_current_user` checks signature, expiry, token type and an active user row |
| Error shape | Single `401` for every credential failure; `409` for duplicate emails; `422` for input |
| Enumeration | Unknown email, wrong password and inactive account are indistinguishable |
| Page protection | Optimistic cookie check in `proxy.ts`, authoritative API check in the page |

See [ADR 0002](adr/0002-jwt-authentication.md) for the reasoning and rejected alternatives.

## Security posture

- Non-root users in both images; no build toolchains in runtime layers.
- Browser hardening headers (`nosniff`, `DENY` framing, strict referrer policy) on API responses.
- Argon2id password hashing and JWT helpers in `app/core/security.py` are the single crypto entry
  point used by the auth service.
- Passwords never appear in responses, logs or validation errors; `UserResponse` is a narrow
  projection of the model.
- Access tokens stay server-side in an httpOnly cookie — never in browser storage or RSC props.
- Secrets come from the environment/secret manager; `.env` files are git-ignored.
- Database access is pooled and parameterised through SQLAlchemy; no string-built SQL.

## Scaling path

1. **API** — stateless; scale replicas behind a load balancer. Increase `DATABASE_POOL_SIZE` only
   with replica count in mind (connections = replicas × pool).
2. **Database** — add read replicas for read-heavy endpoints, then partition high-volume tables.
3. **Async work** — introduce a queue (e.g. Redis + workers) for ingestion and inference; the
   service layer is already the seam where work would be enqueued.
4. **ML serving** — deploy `ml` pipelines as a dedicated inference service that imports the same
   contract, keeping GPU requirements out of the API image.
5. **Frontend** — static/RSC pages cache well; add a CDN in front of the web tier.

## Decisions

- [ADR 0001 — Monorepo foundation](adr/0001-monorepo-architecture.md)
- [ADR 0002 — JWT authentication](adr/0002-jwt-authentication.md)
