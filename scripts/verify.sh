#!/usr/bin/env bash
#
# Run the local quality gates that mirror CI. Container image builds and jobs that need a live
# PostgreSQL/Compose stack are CI-only; see the summary at the end and docs/development.md §6.
#
#   ./scripts/verify.sh                          # all local gates
#   NEXA_VERIFY_INTEGRATION=1 ./scripts/verify.sh  # plus the cross-service suite (stack required)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/python ]]; then
  echo "Missing .venv — run ./scripts/bootstrap.sh first." >&2
  exit 1
fi

if [[ ! -d frontend/node_modules ]]; then
  echo "Missing frontend/node_modules — run ./scripts/bootstrap.sh first." >&2
  exit 1
fi

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
note() { printf '\033[1;33m    %s\033[0m\n' "$*"; }

step "Backend: lint & formatting"
(cd backend && ../.venv/bin/ruff check . && ../.venv/bin/ruff format --check .)

step "Backend: tests (in-memory SQLite)"
(cd backend && ../.venv/bin/python -m pytest)

# Mirrors the dedicated CI step: prove Alembic's real migrations apply to a SQLite file and that
# the auth flow writes to the schema they create.
step "Backend: SQLite migrations & auth flow"
(cd backend && ../.venv/bin/python -m pytest tests/test_sqlite_migrations.py)

step "Backend: migration SQL (PostgreSQL dialect)"
(cd backend && ../.venv/bin/alembic upgrade head --sql >/dev/null)

step "ML workspace: lint & tests"
(cd ml && ../.venv/bin/ruff check . && ../.venv/bin/ruff format --check . && ../.venv/bin/python -m pytest)

step "Frontend: lint"
(cd frontend && npm run lint)

step "Frontend: typecheck"
(cd frontend && npm run typecheck)

# `--coverage` applies the thresholds in vitest.config.mts, so a coverage regression fails here
# exactly as it does in CI instead of being visible only in the uploaded report.
step "Frontend: tests & coverage gate"
(cd frontend && npm test -- --coverage)

step "Frontend: production build"
(cd frontend && npm run build)

if [[ "${NEXA_VERIFY_INTEGRATION:-0}" == "1" ]]; then
  if ! (cd "$ROOT" && .venv/bin/python -c "import httpx" >/dev/null 2>&1); then
    note "Integration dependencies are missing. Run: .venv/bin/pip install -r tests/requirements.txt"
    exit 1
  fi
  step "Integration: cross-service suite"
  (cd "$ROOT" && .venv/bin/python -m pytest tests -q)
else
  step "Integration: skipped"
  note "Set NEXA_VERIFY_INTEGRATION=1 with a running stack (./scripts/dev.sh) to run tests/."
fi

if command -v docker >/dev/null 2>&1; then
  step "Docker: compose configuration"
  docker compose config --quiet
else
  step "Docker: CLI not installed — skipping compose validation"
fi

printf '\n\033[1;32mAll local gates passed.\033[0m\n'
cat <<'EOF'

CI additionally runs, which this script does not start:
  • "backend"     — applies Alembic migrations to a real PostgreSQL 17 service
  • "integration" — builds both images, starts the Compose stack, runs the integration suite,
                    including the database-outage test
  • "sqlite"      — starts both services as processes and runs the integration suite
  • JUnit/coverage artifacts and job summaries

This script generates PostgreSQL DDL but cannot apply it without a database server, and it does
not build images or start services (the optional integration step expects a stack you started).

To check the cross-service suite locally, start ./scripts/dev.sh, then run:
  NEXA_VERIFY_INTEGRATION=1 ./scripts/verify.sh
EOF
