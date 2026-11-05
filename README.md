# Nexa AI

> The foundation for production AI products — a modular monorepo with a typed web application, an
> async API, PostgreSQL persistence, an ML workspace and CI/CD that verifies every layer.

[![CI](https://github.com/SakshamOmer01/nexa-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/SakshamOmer01/nexa-ai/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

Nexa AI is the starting point for the platform, not a demo: both services boot, migrate, expose
health probes, build into non-root images and are verified by CI. Product features are added on top
of these boundaries instead of reshaping them.

---

## What's inside

| Layer | Stack | Location | Deployable |
| --- | --- | --- | --- |
| Web application | Next.js 16 (App Router, RSC), TypeScript, Tailwind CSS v4, shadcn/ui | [`frontend/`](frontend) | Yes (Node standalone) |
| API | FastAPI, Pydantic v2, SQLAlchemy 2.0 async, Alembic | [`backend/`](backend) | Yes (Uvicorn) |
| Database | PostgreSQL 17 | `docker-compose.yml` | Yes (managed in prod) |
| ML workspace | Python package: pipeline contract + registry | [`ml/`](ml) | Library |
| Delivery | Multi-stage Docker, Docker Compose, GitHub Actions | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | — |

## Architecture

```text
Browser
   │
   ▼
frontend/  Next.js 16 · App Router · shadcn/ui
   │  server-side fetch (API_INTERNAL_URL) or browser fetch (NEXT_PUBLIC_API_URL)
   ▼
backend/   FastAPI · /api/v1 · schemas → services → models
   │  SQLAlchemy 2.0 async (asyncpg) · pooled connections
   ▼
PostgreSQL 17   ← Alembic migrations

ml/  pipeline contracts consumed by training jobs and future inference workers
```

Design rules:

- **One direction of dependency.** Routers never query the ORM directly; services never build HTTP
  responses. The web app owns presentation, the API owns domain logic.
- **Typed boundaries.** Pydantic schemas on the server, mirrored TypeScript types on the client.
- **Instance-owned infrastructure.** The engine, settings and clock live on `app.state`, created by
  the app factory, so tests build an isolated app.
- **Two probes per service.** Cheap liveness and dependency-aware readiness.
- **Fail fast.** Settings are validated at start-up, with hard guards for production.

Read [docs/architecture.md](docs/architecture.md) for the full design and
[ADR 0001](docs/adr/0001-monorepo-architecture.md) for the reasoning behind the layout.

## Repository layout

```text
nexa-ai/
├── frontend/                 # Next.js application
│   ├── src/app/              # routes, layout, /api/health
│   ├── src/components/       # ui primitives, layout, sections
│   ├── src/config/           # site metadata and foundation content
│   ├── src/lib/              # env validation, typed API client
│   └── src/types/            # shared wire contracts
├── backend/                  # FastAPI service
│   ├── app/api/              # v1 routers, system routes, dependencies
│   ├── app/core/             # settings, logging, security, errors, middleware
│   ├── app/db/               # engine/session, declarative base
│   ├── app/models/           # SQLAlchemy models
│   ├── app/schemas/          # Pydantic contracts
│   ├── app/services/         # business logic
│   ├── alembic/              # migrations
│   └── tests/                # unit & contract tests
├── ml/                       # ML workspace (pipelines, registry, settings)
├── docs/                     # architecture, development guide, ADRs
├── scripts/                  # bootstrap, dev, verify, wait-for-http
├── tests/                    # cross-service integration tests
├── .github/workflows/        # CI pipeline
├── docker-compose.yml        # db + api + web
├── .env.example              # compose-level environment contract
└── Makefile                  # common tasks (make help)
```

## Quick start

### Option A — Docker Compose (fastest)

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
| --- | --- |
| Web app | <http://localhost:3000> |
| API | <http://localhost:8000> |
| API docs | <http://localhost:8000/docs> |
| PostgreSQL | `localhost:5432` |

The API container applies Alembic migrations before serving, and both images ship health checks.

### Option B — local processes

Requires Node 22+, Python 3.11+, and PostgreSQL 17 (or Docker for just the database).

```bash
cp .env.example .env
./scripts/bootstrap.sh        # env files + venv + npm ci
./scripts/dev.sh              # db (docker), migrations, API :8000, web :3000
```

### Make targets

```bash
make help        # list targets
make bootstrap   # install everything
make dev         # run the stack locally
make verify      # every quality gate (same commands as CI)
make up / down   # docker compose stack
```

## Configuration

Environment templates live next to the code that reads them:
[`.env.example`](.env.example) (compose), [`backend/.env.example`](backend/.env.example),
[`frontend/.env.example`](frontend/.env.example), [`ml/.env.example`](ml/.env.example).

**Backend** (validated by Pydantic settings):

| Variable | Default | Notes |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | `development`, `test`, `staging`, `production` |
| `DEBUG` | `false` | Must be `false` in production |
| `SECRET_KEY` | dev placeholder | 32+ unique characters required in production |
| `DATABASE_URL` | local asyncpg URL | Must use `postgresql+asyncpg://` |
| `DATABASE_POOL_SIZE` / `DATABASE_MAX_OVERFLOW` | `5` / `10` | Tune with replica count |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated, explicit origins |
| `LOG_LEVEL` | `INFO` | JSON logs in containers |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | JWT lifetime |

**Frontend**:

| Variable | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | `Nexa AI` | Branding/metadata |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Browser-visible API origin |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical/OpenGraph URL |
| `API_INTERNAL_URL` | falls back to public URL | Server-only, e.g. `http://backend:8000/api/v1` |

Configuration rules:

- `.env` files are git-ignored; only `*.env.example` is committed.
- `NEXT_PUBLIC_*` is inlined at build time — never a secret.
- Production start-up fails if the secret is a placeholder, `DEBUG=true`, or CORS is `*`.
- Interactive API docs are disabled in production unless `DOCS_ENABLED=true`.

## API and health checks

| Method | Path | Purpose | Success | Failure |
| --- | --- | --- | --- | --- |
| `GET` | `/` | Service metadata | `200` | — |
| `GET` | `/health` | Liveness (no I/O) | `200` | — |
| `GET` | `/api/v1/health` | Readiness incl. PostgreSQL | `200` `ok` | `503` `degraded` |
| `GET` | `/api/v1/health/live` | Versioned liveness | `200` | — |
| `GET` | `/docs`, `/openapi.json` | Interactive docs / schema | `200` | disabled in prod |
| `GET` | `/api/health` | **Web** liveness + backend/DB status | `200` | `200` `degraded` |

```bash
curl -s localhost:8000/api/v1/health | jq
# {
#   "status": "ok",
#   "service": "Nexa AI API",
#   "version": "0.1.0",
#   "environment": "development",
#   "timestamp": "2026-11-05T05:57:11.777303Z",
#   "uptime_seconds": 1.453,
#   "dependencies": [{ "name": "postgresql", "status": "up", "latency_ms": 0.92, "detail": null }]
# }
```

Every response carries `X-Request-ID` and `X-Process-Time-Ms`; errors use a single envelope:

```json
{ "error": { "code": "not_found", "detail": "Not Found" }, "request_id": "dc55f1…" }
```

## Testing & quality gates

```bash
make verify            # everything CI runs
```

| Gate | Command | Scope |
| --- | --- | --- |
| Backend lint/format | `cd backend && ruff check . && ruff format --check .` | 23 tests below |
| Backend tests | `cd backend && ../.venv/bin/python -m pytest` | health, config, security (SQLite-backed) |
| Migration DDL | `cd backend && ../.venv/bin/alembic upgrade head --sql` | PostgreSQL dialect |
| ML lint/tests | `cd ml && ruff check . && pytest` | pipeline + registry |
| Frontend lint | `cd frontend && npm run lint` | ESLint (Next config) |
| Frontend types | `cd frontend && npm run typecheck` | `next typegen` + `tsc --noEmit` |
| Frontend build | `cd frontend && npm run build` | production standalone build |
| Integration | `pytest tests` | requires a running stack |
| Containers | `docker compose config` + CI build | Compose + images |

## Docker

Both images are multi-stage and run as non-root:

- `frontend` — Node 22 Alpine, `npm ci` → `next build` → standalone `server.js`, health check on
  `/api/health`.
- `backend` — Python 3.12 slim, isolated virtualenv, source + Alembic, health check on `/health`,
  access logs disabled (the app already logs every request).

Compose orders startup with health conditions: `db` → `backend` (runs migrations) → `frontend`.

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests and pushes to `main`:

| Job | Verifies |
| --- | --- |
| `backend` | ruff, migrations applied to a real PostgreSQL 17 service, app import, pytest |
| `frontend` | npm ci, ESLint, typecheck, production build |
| `ml` | ruff, pytest |
| `integration` | `docker compose config`, image builds, stack startup, health gate, cross-service tests |

Deployment is intentionally not wired to an environment yet; the images and probes are ready for any
orchestrator.

## Security

- Secrets come from the environment/secret manager; nothing sensitive is committed.
- Production guards reject placeholder secrets, debug mode and wildcard CORS at start-up.
- Non-root containers, no build toolchains in runtime images.
- Browser hardening headers on API responses; inbound request ids are validated before logging.
- Argon2id hashing and JWT helpers are centralised in `backend/app/core/security.py`.
- Database access is parameterised through SQLAlchemy; connections are pooled with pre-ping.

## Roadmap

- Authentication and multi-tenant accounts on top of the `User` model
- Contract generation (OpenAPI → typed client) once the API surface grows
- Model registry, evaluation gates and an inference worker using `ml/`
- OpenTelemetry traces/metrics, alerting on readiness failures
- Background jobs for ingestion and long-running inference

## Documentation

- [Architecture](docs/architecture.md)
- [Development guide](docs/development.md)
- [ADR 0001 — Monorepo foundation](docs/adr/0001-monorepo-architecture.md)
- [Backend README](backend/README.md) · [ML README](ml/README.md)

## License

Proprietary. All rights reserved unless a separate license is added by the repository owner.
