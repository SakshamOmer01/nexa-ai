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

## Quality gates

```bash
ruff check . && ruff format --check .
pytest
```
