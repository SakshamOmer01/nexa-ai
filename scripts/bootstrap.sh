#!/usr/bin/env bash
#
# Install every workspace and create local environment files.
# Safe to re-run; never overwrites an existing .env file.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
VENV="$ROOT/.venv"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

info "Creating local environment files (.env is git-ignored)"
[[ -f .env ]] || cp .env.example .env
[[ -f backend/.env ]] || cp backend/.env.example backend/.env
[[ -f frontend/.env.local ]] || cp frontend/.env.example frontend/.env.local

info "Preparing Python virtualenv at .venv"
if [[ ! -d "$VENV" ]]; then
  "$PYTHON" -m venv "$VENV"
fi
"$VENV/bin/python" -m pip install --upgrade pip >/dev/null

info "Installing backend dependencies"
"$VENV/bin/pip" install -e "./backend[dev]"

info "Installing ML workspace dependencies"
"$VENV/bin/pip" install -e "./ml[dev]"

info "Installing frontend dependencies"
(cd frontend && npm ci)

cat <<'EOF'

Bootstrap complete.

Next steps:
  1. Review the generated environment files:
       .env, backend/.env, frontend/.env.local
  2. Start PostgreSQL (docker compose up -d db) and apply migrations:
       cd backend && ../.venv/bin/alembic upgrade head
  3. Run both apps:
       ./scripts/dev.sh
EOF
