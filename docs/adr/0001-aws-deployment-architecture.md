# ADR 0001 — AWS Deployment Architecture

## Status

Accepted

## Context

FastSpec was originally deployed by SSHing into a single server running `docker compose up`. The goal is to transition to AWS for production reliability, with floci (https://github.com/floci-io/floci) used as a local AWS emulator so that the same IaC definitions run in development, CI, and production.

The backend container bundles both Python (FastAPI/uvicorn) and Node.js (Spectral CLI) in a single image. Spectral is invoked as a subprocess and writes temporary files to the OS `/tmp` — the container is otherwise stateless. All durable state lives in PostgreSQL and Redis.

The frontend and landing-page are static Vue/Nginx builds. They contain SPA routing (fallback to `index.html`) and an OAuth callback rewrite that Nginx currently handles.

## Decision

### Compute

- **Backend**: ECS Fargate. The existing Docker image runs unchanged. No EFS is needed — the `./data` volume mount was unused and is dropped.
- **Frontend + Landing Page**: S3 + CloudFront. Nginx is replaced by CloudFront behaviours and a CloudFront Function for the OAuth callback rewrite and SPA fallback.

### Networking / Ingress

- Traefik is replaced by an **Application Load Balancer (ALB)**. The ALB routes `/api/*` and `/auth/*` to the ECS Fargate service.
- CloudFront sits in front of S3 for frontend and landing-page assets.
- Per-environment subdomains managed via Route53 + ACM:
  - `local` → `http://localhost` (floci, no TLS)
  - `dev` → `https://dev.fastspec.kaseovo.com`
  - `staging` → `https://staging.fastspec.kaseovo.com`
  - `prod` → `https://fastspec.kaseovo.com`

### Data

- **PostgreSQL** → Amazon RDS (Postgres 16).
- **Redis** → Amazon ElastiCache (Redis 7).
- Both are emulated locally by floci.

### Secrets

- All secrets (JWT key, OAuth client credentials, DB password) stored in **AWS Secrets Manager**.
- CDK injects them into the ECS task definition via `ecs.Secret.fromSecretsManager()`.
- floci emulates Secrets Manager locally.

### Database migrations

- `Base.metadata.create_all()` is replaced by **Alembic**.
- An initial migration is generated from the current SQLAlchemy models.
- An ECS Run Task (one-off task) runs `alembic upgrade head` before each service deployment.

### IaC

- **AWS CDK (TypeScript)**. A single CDK app with four environment-specific stacks driven by `--context env=local|dev|staging|prod`. The `local` context is consumed by floci; the remaining three deploy to real AWS.

### CI/CD

- The existing SSH deploy step in `deploy-and-version.yml` is replaced with: build + push to ECR, then `cdk deploy`.
- Triggered manually via `workflow_dispatch` (preserving existing manual deploy pattern).
- Version bumping and GitHub Release creation are retained as-is.

### floci

- `docker-compose` is retired entirely. floci replaces it for both local development and CI.
- floci emulates: ECS, ALB, RDS (Postgres), ElastiCache (Redis), S3, CloudFront, Secrets Manager.

## Alternatives Considered

### Lambda for backend
Rejected. The backend spawns a Spectral CLI subprocess on every lint request. Lambda's ephemeral filesystem and cold-start overhead make subprocess-based workloads awkward. ECS Fargate runs the container as-is with no code changes.

### App Runner for backend
Rejected. App Runner provides less control over VPC placement, security groups, and ALB integration. Fargate + ALB gives a cleaner path to connecting to RDS and ElastiCache inside a VPC.

### Keep Traefik in AWS
Rejected. Traefik is a development convenience. ALB is the standard AWS-native ingress, integrates with ACM for TLS, and is natively supported by CDK ECS patterns.

### Terraform instead of CDK
Rejected for this project. FastSpec is AWS-only. CDK's L2/L3 constructs for ECS, ALB, RDS, ElastiCache, CloudFront, and S3 reduce boilerplate significantly. Terraform's provider-agnostic flexibility is not needed here.
