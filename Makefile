.PHONY: up down secrets infra migrate help

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

## secrets: Seed .env key-value pairs into floci SSM as SecureString parameters
secrets:
	@bash scripts/seed-ssm.sh

## infra: Deploy CDK stacks (DataStack then ComputeStack) against floci
infra:
	cd infra && $(FLOCI_AWS_VARS) \
	  npx cdk deploy --all --context env=local --require-approval never \
	  -v
	@echo "✓ infra deployed"

## migrate: Run the Migration ECS task to completion against floci
migrate:
	@bash scripts/run-migrate.sh

## help: List available targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //' | column -t -s ':'
