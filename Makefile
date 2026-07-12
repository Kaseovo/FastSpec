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

## db: Start Postgres locally (needed for make backend). No Redis — the app
## has none; RDS/PostgreSQL is the only datastore in every environment.
db:
	docker compose up -d postgres

## secrets: Seed .env key-value pairs into floci SSM as SecureString parameters
secrets:
	@bash scripts/seed-ssm.sh

## infra: Bootstrap CDK then deploy all stacks (DataStack, LambdaStack, FrontendStack, WakeStack) against floci
infra:
	cd infra && $(FLOCI_AWS_VARS) \
	  npx cdk bootstrap --context env=local
	cd infra && $(FLOCI_AWS_VARS) \
	  npx cdk deploy --all --context env=local --require-approval never \
	  -v
	@echo "✓ infra deployed"

## migrate: Run Alembic migrations locally (prod runs the same via a Lambda
## {"migrate": true} invocation — see backend/lambda_handler.py — no ECS task)
migrate:
	@bash scripts/run-migrate.sh

## backend: Start the FastAPI dev server with env vars loaded from .env
backend:
	cd backend && env $(shell grep -v '^#' .env | grep '=' | xargs) \
	  DATABASE_URL=postgresql://fastspec:fastspec@localhost:5432/fastspec \
	  ../.venv/bin/uvicorn main:app --reload --port 8000

## frontend: Start the Vite dev server on port 5173 pointed at the local backend Lambda
frontend:
	cd frontend && VITE_API_BASE_URL=http://localhost:8000 VITE_LANDING_URL=http://localhost:3000 npm run dev

## logs: Tail backend Lambda logs from floci
logs:
	$(FLOCI_AWS_VARS) aws logs tail /aws/lambda/fastspec-backend --follow

## landing: Build and run the landing page container on http://localhost:3000
landing:
	docker build -t fastspec-landing-page -f landing-page/Dockerfile .
	docker rm -f fastspec-landing-page 2>/dev/null || true
	docker run -d --name fastspec-landing-page -p 3000:80 fastspec-landing-page
	@echo "✓ landing page running at http://localhost:3000"

## dev: Full local dev workflow — up, secrets, infra, migrate, landing, frontend
dev: up secrets infra migrate landing frontend

## help: List available targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //' | column -t -s ':'
