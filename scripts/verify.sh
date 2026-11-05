#!/usr/bin/env bash
#
# Run every local quality gate. CI runs the same commands, so a green run here means a green PR.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/python ]]; then
  echo "Missing .venv — run ./scripts/bootstrap.sh first." >&2
  exit 1
fi

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

step "Backend: lint & formatting"
(cd backend && ../.venv/bin/ruff check . && ../.venv/bin/ruff format --check .)

step "Backend: tests"
(cd backend && ../.venv/bin/python -m pytest)

step "Backend: migration SQL (PostgreSQL dialect)"
(cd backend && ../.venv/bin/alembic upgrade head --sql >/dev/null)

step "ML workspace: lint & tests"
(cd ml && ../.venv/bin/ruff check . && ../.venv/bin/ruff format --check . && ../.venv/bin/python -m pytest)

step "Frontend: lint"
(cd frontend && npm run lint)

step "Frontend: typecheck"
(cd frontend && npm run typecheck)

step "Frontend: production build"
(cd frontend && npm run build)

if command -v docker >/dev/null 2>&1; then
  step "Docker: compose configuration"
  docker compose config --quiet
else
  step "Docker: CLI not installed — skipping compose validation"
fi

printf '\n\033[1;32mAll checks passed.\033[0m\n'
