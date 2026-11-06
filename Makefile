# Nexa AI — developer shortcuts. Run `make help` for the list.

.DEFAULT_GOAL := help
SHELL := /bin/bash
VENV := .venv

.PHONY: help bootstrap install dev build lint test e2e e2e-compose verify migrate up down logs ps clean

help: ## Show available targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

bootstrap: ## Create env files, install frontend/backend/ML dependencies
	./scripts/bootstrap.sh

install: ## Install dependencies only (no env files)
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install -e "./backend[dev]" -e "./ml[dev]"
	cd frontend && npm ci

dev: ## Run PostgreSQL, migrations, API and web app
	./scripts/dev.sh

build: ## Production build of the frontend
	cd frontend && npm run build

lint: ## Lint and format-check backend, ML and frontend
	cd backend && ../$(VENV)/bin/ruff check . && ../$(VENV)/bin/ruff format --check .
	cd ml && ../$(VENV)/bin/ruff check . && ../$(VENV)/bin/ruff format --check .
	cd frontend && npm run lint

test: ## Run backend and ML tests (frontend: cd frontend && npm test)
	cd backend && ../$(VENV)/bin/python -m pytest
	cd ml && ../$(VENV)/bin/python -m pytest

e2e: ## Run Playwright browser tests (requires a running stack and Chromium)
	cd frontend && npm run test:e2e

e2e-compose: ## Run the Playwright suite against the Compose stack (build, wait, test, tear down)
	@set -euo pipefail; \
	status=0; \
	frontend_origin="http://localhost:$${FRONTEND_PORT:-3000}"; \
	backend_origin="http://localhost:$${BACKEND_PORT:-8000}"; \
	if ! command -v node >/dev/null 2>&1; then \
		echo "Node.js is required for the browser suite; install Node 22 or newer" >&2; \
		exit 1; \
	fi; \
	if ! ( cd frontend && node -e "require.resolve('@playwright/test')" >/dev/null 2>&1 ); then \
		echo "Frontend dependencies are missing or incomplete; run: cd frontend && npm ci" >&2; \
		exit 1; \
	fi; \
	running="$$(docker compose ps --services --status running 2>/dev/null)"; \
	if [ -n "$$running" ]; then \
		echo "A Compose stack is already running:" >&2; \
		echo "$$running" | sed 's/^/  /' >&2; \
		echo "Stop it with make down, then rerun make e2e-compose." >&2; \
		exit 1; \
	fi; \
	chromium_present() { ( cd frontend && node -e "const { chromium } = require('@playwright/test'); process.exit(require('fs').existsSync(chromium.executablePath()) ? 0 : 1)" ); }; \
	if ! chromium_present; then \
		if [ "$${INSTALL_BROWSER:-0}" = "1" ]; then \
			echo "Playwright Chromium is missing; installing it (INSTALL_BROWSER=1)"; \
			( cd frontend && npx playwright install chromium ); \
			chromium_present || { echo "Chromium is still missing after the install" >&2; exit 1; }; \
		else \
			echo "Playwright Chromium is not installed; run: cd frontend && npx playwright install chromium" >&2; \
			echo "Or set INSTALL_BROWSER=1 to install it as part of this target." >&2; \
			exit 1; \
		fi; \
	fi; \
	trap 'if [ "$${KEEP_STACK:-0}" = "1" ]; then echo "KEEP_STACK=1: leaving the stack up; run make down when done"; else docker compose down || true; fi' EXIT; \
	echo "Starting the Compose stack (browser tests will target $${frontend_origin})"; \
	docker compose up -d --build; \
	./scripts/wait-for-http.sh "$${backend_origin}/api/v1/health" 180; \
	./scripts/wait-for-http.sh "$${frontend_origin}/api/health" 180; \
	( cd frontend && E2E_BASE_URL="$${frontend_origin}" E2E_API_URL="$${backend_origin}/api/v1" npm run test:e2e ) || status=$$?; \
	if [ "$$status" -ne 0 ]; then \
		echo "Browser flows failed; inspect the run:"; \
		echo "  report: frontend/playwright-report/index.html"; \
		echo "  traces, screenshots and videos: frontend/test-results/e2e"; \
	fi; \
	exit "$$status"

verify: ## Run the local gates that mirror CI (integration: NEXA_VERIFY_INTEGRATION=1)
	./scripts/verify.sh

migrate: ## Apply database migrations
	cd backend && ../$(VENV)/bin/alembic upgrade head

up: ## Start the full Docker Compose stack
	docker compose up --build -d

down: ## Stop the Docker Compose stack
	docker compose down

logs: ## Tail Docker Compose logs
	docker compose logs -f --tail=100

ps: ## Show Compose service status
	docker compose ps

clean: ## Remove build output and caches (keeps dependencies)
	rm -rf frontend/.next frontend/out backend/.pytest_cache backend/.ruff_cache ml/.pytest_cache ml/.ruff_cache
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
