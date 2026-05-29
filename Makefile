.PHONY: up down secrets help

## up: Start floci and wait until healthy
up:
	docker compose -f docker-compose.floci.yml up -d --wait

## down: Stop and remove the floci container
down:
	docker compose -f docker-compose.floci.yml down

## secrets: Seed .env key-value pairs into floci SSM as SecureString parameters
secrets:
	@bash scripts/seed-ssm.sh

## help: List available targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //' | column -t -s ':'
