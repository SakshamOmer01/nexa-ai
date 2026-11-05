# Nexa AI — developer shortcuts. Run `make help` for the list.

.DEFAULT_GOAL := help
SHELL := /bin/bash
VENV := .venv

.PHONY: help bootstrap install dev build lint test verify migrate up down logs ps clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
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

test: ## Run backend and ML tests
	cd backend && ../$(VENV)/bin/python -m pytest
	cd ml && ../$(VENV)/bin/python -m pytest

verify: ## Run every quality gate (same commands as CI)
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
