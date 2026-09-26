# ADR-0001: Replace docker-compose with CDK + floci for local development

**Status:** Superseded in part by [ADR-0008](0008-single-image-self-hosting.md) — floci remains the way to work on the AWS deployment, but running FastSpec locally now uses the single Docker image or `make dev`.  
**Date:** 2026-05-29

## Context

FastSpec's local development environment is driven by `docker-compose.yml` and `docker-compose.dev.yml`. These files are maintained separately from the planned AWS deployment configuration (ECS Fargate, RDS, ElastiCache, ALB, S3, CloudFront via CDK). As a result, local behaviour diverges from production: Traefik is used locally instead of ALB, Postgres and Redis run as raw Docker containers rather than RDS/ElastiCache, and environment variables are injected from a `.env` file rather than SSM. The goal is to eliminate that divergence as a prerequisite for AWS deployment.

## Decision

Replace docker-compose with a CDK-driven floci environment for all backend infrastructure. The CDK codebase lives in `infra/` and is written in **TypeScript**. It is structured as two layered stacks:

- **DataStack** — RDS (PostgreSQL) and ElastiCache (Redis), exporting connection endpoints.
- **ComputeStack** — ECS Fargate service (backend), ALB with listener rules, and SSM Parameter Store secret references wired into the ECS task definition.

All four Deployment Environments (`local`, `dev`, `staging`, `prod`) use the same CDK stacks. The `local` environment targets floci at `http://localhost:4566` instead of real AWS endpoints.

Secrets are managed via SSM Parameter Store in all environments. Locally, a `make secrets` target seeds floci's SSM from the `.env` file before stack deployment.

**Frontend and landing-page are excluded from the floci Environment.** They continue to run as local processes (Vite dev server, static file server) pointed at the local ALB. S3 and CloudFront CDK constructs are only deployed to `dev`, `staging`, and `prod`.

A `Makefile` provides the developer workflow entry point (`make dev`, `make infra`, `make secrets`, `make migrate`).

## Alternatives considered

**Keep docker-compose for local, use CDK only for AWS.** Rejected because it preserves the local/prod divergence that motivates this change. Any bug that only reproduces in AWS is harder to diagnose.

**Use LocalStack instead of floci.** Rejected because LocalStack Community was sunset in March 2026, now requiring auth tokens and frozen on security updates. Floci is the free, no-auth-token alternative with comparable service coverage.

**CDK in Python (matching the backend).** Rejected because CDK's TypeScript bindings are first-class — better type coverage, more examples, and the CDK constructs library is authored in TypeScript. The IaC language is a separate concern from the application language.

**Full floci parity for frontend and landing-page (S3 + CloudFront locally).** Rejected for two reasons. First, floci's CloudFront support is **management-plane only** — distributions, cache policies, and OAC can be created, but actual content delivery through a CloudFront domain is not emulated. Files would have to be accessed via the raw S3 endpoint (`localhost:4566`), which is a worse local experience than the current dev servers. Second, including the frontend means replacing the Vite dev server with a build → S3-sync loop, eliminating HMR. The CDK S3 + CloudFront construct definitions are validated through CDK assertion tests instead (see Consequences).

## Consequences

- The `docker-compose.yml` and `docker-compose.dev.yml` files are removed once the floci environment is stable.
- The Spectral Sidecar (defined in CONTEXT.md) is deferred — the initial ECS task has a single backend container. It is introduced in a subsequent piece of work without changing the stack structure.
- The Migration Task CDK construct is stubbed until Alembic is bootstrapped in the backend. Until then, `Base.metadata.create_all()` remains in the backend startup path.
- Local development requires Docker, the floci CLI (or `docker compose` pointing at the floci image), and the AWS CDK CLI with `AWS_ENDPOINT_URL=http://localhost:4566`.
- The S3 + CloudFront CDK constructs (excluded from the `local` Deployment Environment) are covered by **CDK assertion tests** (`aws-cdk-lib/assertions`) that run against the synthesised CloudFormation template. This ensures construct configuration (OAC, bucket policies, distribution settings) is validated in CI without requiring floci content-delivery emulation.
