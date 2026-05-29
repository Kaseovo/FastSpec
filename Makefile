.PHONY: up down db secrets infra migrate backend frontend logs dev help

FLOCI_AWS_VARS = \
	AWS_ENDPOINT_URL=http://localhost:4566 \
	AWS_ACCESS_KEY_ID=test \
	AWS_SECRET_ACCESS_KEY=test \
	AWS_DEFAULT_REGION=us-east-1

## up: Start floci and wait until healthy
up:
	docker compose -f docker-compose.floci.yml up -d --wait

## down: Stop and remove the floci container
down:
	docker compose -f docker-compose.floci.yml down

## db: Start Postgres and Redis locally (needed for make backend)
db:
	docker compose up -d postgres redis

## secrets: Seed .env key-value pairs into floci SSM as SecureString parameters
secrets:
	@bash scripts/seed-ssm.sh

## infra: Bootstrap CDK then deploy all stacks (DataStack then ComputeStack) against floci
infra:
	cd infra && $(FLOCI_AWS_VARS) \
	  npx cdk bootstrap --context env=local
	cd infra && $(FLOCI_AWS_VARS) \
	  npx cdk deploy --all --context env=local --require-approval never \
	  -v
	@echo "✓ infra deployed"

## migrate: Run the Migration ECS task to completion against floci
migrate:
	@bash scripts/run-migrate.sh

## backend: Start the FastAPI dev server with env vars loaded from .env
backend:
	cd backend && env $(shell grep -v '^#' .env | grep '=' | xargs) \
	  DATABASE_URL=postgresql://fastspec:fastspec@localhost:5432/fastspec \
	  REDIS_HOST=localhost \
	  ../.venv/bin/uvicorn main:app --reload --port 8000

## frontend: Start the Vite dev server on port 5173 pointed at the local ALB
frontend:
	cd frontend && VITE_API_BASE_URL=http://localhost:8000 npm run dev

## logs: Tail backend ECS container logs from floci
logs:
	$(FLOCI_AWS_VARS) aws logs tail /ecs/fastspec-backend --follow

## dev: Full local dev workflow — up, secrets, infra, migrate, frontend
dev: up secrets infra migrate frontend

## help: List available targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //' | column -t -s ':'
