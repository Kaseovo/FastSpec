.DEFAULT_GOAL := help
.PHONY: help setup dev backend frontend test test-backend test-frontend lint \
        docker-build docker-run transfer-local-data \
        floci-up floci-down floci-secrets floci-infra floci-migrate floci-logs

PYTHON ?= python3.12
VENV   := .venv
DATA   := $(CURDIR)/.data

## help: List available targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## //' | \
	  awk '{ i = index($$0, ":"); printf "  %-22s %s\n", substr($$0, 1, i - 1), substr($$0, i + 2) }'

# ── Everyday development ─────────────────────────────────────────────────────

## setup: Create the Python venv and install backend + frontend dependencies
setup:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install -q --upgrade pip
	$(VENV)/bin/pip install -q -r backend/requirements-dev.txt
	cd frontend && npm ci --no-audit --no-fund
	@echo "✓ ready — run 'make dev'"

## dev: Backend (auto-reload) + Vite dev server → http://localhost:5173/specs/
dev:
	@$(MAKE) -j2 --no-print-directory backend frontend

## backend: FastAPI with auto-reload on :8000 (SQLite in ./.data unless DATABASE_URL is set)
backend:
	cd backend && \
	  FASTSPEC_DATA_DIR=$${FASTSPEC_DATA_DIR:-$(DATA)} \
	  PUBLIC_URL=$${PUBLIC_URL:-http://localhost:5173} \
	  ../$(VENV)/bin/python cli.py migrate && \
	  FASTSPEC_DATA_DIR=$${FASTSPEC_DATA_DIR:-$(DATA)} \
	  PUBLIC_URL=$${PUBLIC_URL:-http://localhost:5173} \
	  ../$(VENV)/bin/uvicorn app:application --reload --port 8000

## frontend: Vite dev server on :5173, proxying /api, /auth and /mcp to :8000
frontend:
	cd frontend && npm run dev

## transfer-local-data: Move single-user data to an account (EMAIL=you@example.com)
transfer-local-data:
	cd backend && FASTSPEC_DATA_DIR=$${FASTSPEC_DATA_DIR:-$(DATA)} \
	  ../$(VENV)/bin/python cli.py transfer-local-data --to "$(EMAIL)"

# ── Tests & checks ───────────────────────────────────────────────────────────

## test: Run backend and frontend test suites
test: test-backend test-frontend

## test-backend: pytest (set TEST_POSTGRES_URL to also run the Postgres migration tests)
test-backend:
	cd backend && ../$(VENV)/bin/python -m pytest tests -q

## test-frontend: vitest
test-frontend:
	cd frontend && npm test

## lint: ruff on the backend
lint:
	$(VENV)/bin/ruff check backend

# ── Docker ───────────────────────────────────────────────────────────────────

## docker-build: Build the self-hosted image (fastspec:dev)
docker-build:
	docker build -t fastspec:dev .

## docker-run: Run the self-hosted image with SQLite → http://localhost:8080
docker-run:
	docker run --rm -p 127.0.0.1:8080:8080 -v fastspec-dev-data:/data fastspec:dev

# ── AWS deployment, emulated locally with floci (maintainers of the hosted
#    version only — see docs/DEPLOYMENT.md) ─────────────────────────────────

FLOCI_AWS_VARS = \
	AWS_ENDPOINT_URL=http://localhost:4566 \
	AWS_ACCESS_KEY_ID=test \
	AWS_SECRET_ACCESS_KEY=test \
	AWS_DEFAULT_REGION=us-east-1

## floci-up: Start floci (local AWS emulator) and wait until healthy
floci-up:
	docker compose -f docker-compose.floci.yml up -d --wait

## floci-down: Stop and remove the floci container
floci-down:
	docker compose -f docker-compose.floci.yml down

## floci-secrets: Seed .env key-value pairs into floci SSM
floci-secrets:
	@bash scripts/seed-ssm.sh

## floci-infra: CDK bootstrap + deploy all stacks against floci
floci-infra:
	cd infra && $(FLOCI_AWS_VARS) npx cdk bootstrap --context env=local
	cd infra && $(FLOCI_AWS_VARS) npx cdk deploy --all --context env=local --require-approval never

## floci-logs: Tail the backend Lambda logs from floci
floci-logs:
	$(FLOCI_AWS_VARS) aws logs tail /aws/lambda/fastspec-backend --follow
