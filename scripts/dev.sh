#!/usr/bin/env bash
#
# Start the local development stack:
#   - PostgreSQL (via Docker, when available)
#   - Alembic migrations
#   - FastAPI on http://localhost:8000 (reload)
#   - Next.js on http://localhost:3000 (dev)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/uvicorn ]]; then
  echo "Missing .venv — run ./scripts/bootstrap.sh first." >&2
  exit 1
fi
[[ -f frontend/node_modules/.package-lock.json ]] || (cd frontend && npm ci)

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "==> Starting PostgreSQL container"
  docker compose up -d db
else
  echo "==> Docker unavailable: expecting PostgreSQL on localhost:5432 (see backend/.env)"
fi

echo "==> Applying database migrations"
(cd backend && ../.venv/bin/alembic upgrade head)

pids=()
cleanup() {
  echo
  echo "==> Stopping dev processes"
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

echo "==> API    http://localhost:8000/docs"
(cd backend && ../.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
pids+=($!)

echo "==> Web    http://localhost:3000"
(cd frontend && npm run dev) &
pids+=($!)

wait -n "${pids[@]}"
