# GitHub Issues — FastSpec AWS Migration + Architecture Refactor

Repo: https://github.com/DishWatcher/FastSpec

Create in this order (blockers first).

---

## Issue A — SpectralClient seam + LintService + LintRulesetRepository extraction

**Labels:** `enhancement`

### What to build

Implement ADR-0003 and ADR-0004 in a single PR. Introduces the `SpectralClient` abstraction layer and extracts lint business logic out of the router into a proper service layer.

**SpectralClient seam (ADR-0003)**

Introduce `backend/validation/spectral_client.py` with:
- `SpectralClient` Protocol: `lint(spec_json: dict, ruleset_yaml: str) -> dict`
- `SubprocessSpectralClient` — wraps existing subprocess logic, selected when `SPECTRAL_MODE=subprocess`
- `HttpSpectralClient` — calls Spectral Sidecar via `POST /lint`, selected when `SPECTRAL_MODE=http`
- `get_spectral_client()` factory — reads `SPECTRAL_MODE` env var
- `SpectralError(RuntimeError)` — canonical error type from both adapters

`build_ruleset_yaml()` and `_parse_result()` remain in `spectral_linter.py` as pure functions.

Add `backend/tests/fakes.py` with `FakeSpectralClient`.

**LintService + LintRulesetRepository (ADR-0004)**

`backend/services/lint_service.py`:
```python
class LintService:
    def __init__(self, db: Session, spectral_client: SpectralClient): ...
    def lint(self, spec_json: dict, user_id: int) -> LintResponse: ...
```
`LintService.lint()` raises `SpectralError` — not `HTTPException`. Router converts to 502.

`backend/services/lint_ruleset_repository.py`:
```python
class LintRulesetRepository:
    def __init__(self, db: Session): ...
    def get(self, user_id: int) -> UserLintRuleset | None: ...
    def upsert(self, user_id: int, rules_json, raw_yaml) -> UserLintRuleset: ...
    def delete(self, user_id: int) -> None: ...  # raises HTTPException 404 if absent
```

Thin `lint.py` router: calls `SpecService.get_spec()` for ownership, `LintService.lint()` for lint, `LintRulesetRepository` for CRUD. Remove `run_spectral()` shim.

### Acceptance criteria

- [ ] `SpectralClient` Protocol defined in `backend/validation/spectral_client.py`
- [ ] `SubprocessSpectralClient` preserves all existing subprocess behaviour
- [ ] `HttpSpectralClient` calls `POST /lint` on `SPECTRAL_SIDECAR_URL`
- [ ] `get_spectral_client()` selects adapter via `SPECTRAL_MODE=subprocess|http`
- [ ] `SpectralError` raised by both adapters; caught by router and converted to 502
- [ ] `FakeSpectralClient` in `backend/tests/fakes.py`
- [ ] `LintService.lint()` unit-tested in `backend/tests/test_lint_service.py` using `FakeSpectralClient`
- [ ] `lint.py` contains no inline DB queries for ruleset management or spec ownership
- [ ] All existing `test_lint_api.py` and `test_lint_ruleset_api.py` tests pass
- [ ] `test_adhoc_lint_custom_ruleset` removed (tests non-existent `ruleset` URL param)
- [ ] `.env.example` updated with `SPECTRAL_MODE` and `SPECTRAL_SIDECAR_URL`

### Blocked by

None — can start immediately

---

## Issue B — Introduce Alembic migrations

**Labels:** `enhancement`

### What to build

Replace `Base.metadata.create_all()` with Alembic. This is a prerequisite for connecting to a persistent RDS instance — `create_all` is additive-only and cannot apply schema changes to existing databases.

Install Alembic, generate an initial migration from the current SQLAlchemy models, and configure the backend to run `alembic upgrade head` on startup (temporarily, until the ECS Migration Task is wired in a later issue).

### Acceptance criteria

- [ ] `alembic` added to `backend/requirements.txt`
- [ ] `alembic/` directory created with `env.py` configured to use `DATABASE_URL` from environment
- [ ] Initial migration generated from current models (`User`, `OpenAPISpec`, `SpecVersion`, `AuthToken`, `APIKey`, `UserLintRuleset`)
- [ ] `Base.metadata.create_all()` removed from `backend/main.py` lifespan
- [ ] `backend/Dockerfile` runs `alembic upgrade head` before starting uvicorn (temporary — replaced by ECS Run Task in issue I)
- [ ] All existing tests continue to pass (test fixtures use in-memory SQLite and remain unaffected)

### Blocked by

None — can start immediately

---

## Issue C — Spectral Sidecar service

**Labels:** `enhancement`

### What to build

Create a minimal Node.js/Fastify HTTP service that runs the Spectral CLI as a subprocess and exposes it over HTTP. This is the Spectral Sidecar defined in ADR-0002.

The sidecar lives in `spectral-sidecar/` at the repo root. It runs as a second container in the same ECS task as the backend (sharing the task network namespace — the backend calls it on `http://localhost:PORT`).

**API:**
- `POST /lint` — body: `{ spec: object, ruleset: string }` → response: raw Spectral JSON output array
- `GET /health` — returns `{ "status": "ok" }`

**Error handling:** exits with non-zero code on Spectral failure (returncode ≥ 2); returns 502 with error detail.

### Acceptance criteria

- [ ] `spectral-sidecar/` directory with `package.json`, `index.js` (or TypeScript), `Dockerfile`
- [ ] `POST /lint` accepts `{ spec, ruleset }`, invokes Spectral CLI subprocess, returns raw JSON
- [ ] `GET /health` returns 200 `{ "status": "ok" }`
- [ ] Spectral exit code 1 (lint issues found) treated as success — only code ≥ 2 is a failure
- [ ] Dockerfile based on `node:20-slim`, installs `@stoplight/spectral-cli@6.16.0` globally
- [ ] Unit tests for the HTTP handler (mock Spectral subprocess)
- [ ] Port configurable via `SPECTRAL_SIDECAR_PORT` env var (default: `3001`)

### Blocked by

None — can start immediately

---

## Issue D — Slim backend Dockerfile + production uvicorn settings

**Labels:** `enhancement`

### What to build

Now that Spectral runs in the sidecar (Issue C), remove Node.js from the backend image and fix the production uvicorn settings.

**Backend Dockerfile changes:**
- Remove Node.js + Spectral CLI installation (entire `apt-get install nodejs` block and `npm install -g @stoplight/spectral-cli` step)
- Remove `ENV SPECTRAL_PATH` line
- Change CMD from `uvicorn main:app --reload ...` to `uvicorn main:app --workers 2 --access-log - --host 0.0.0.0 --port 8000`
- Add `HEALTHCHECK` instruction pointing at `GET /health`

**`.env.example` additions:**
- `SPECTRAL_MODE=subprocess` (local default) / `http` (AWS environments)
- `SPECTRAL_SIDECAR_URL=http://localhost:3001`

### Acceptance criteria

- [ ] `backend/Dockerfile` contains no Node.js or npm installation
- [ ] `SPECTRAL_PATH` env var removed from Dockerfile
- [ ] CMD uses production uvicorn flags (no `--reload`)
- [ ] `HEALTHCHECK` instruction added
- [ ] `.env.example` documents `SPECTRAL_MODE` and `SPECTRAL_SIDECAR_URL`
- [ ] Backend image builds successfully and `docker build` produces a working image
- [ ] `SubprocessSpectralClient` still works locally when `SPECTRAL_MODE=subprocess` and Node.js is available on the host

### Blocked by

Issue C (Spectral Sidecar must exist before Node.js is removed from the backend image)

---

## Issue E — CDK core infrastructure (VPC, RDS, ElastiCache, Secrets Manager)

**Labels:** `enhancement`

### What to build

Create the `infra/` CDK TypeScript app and implement the foundational AWS resources shared across `dev`, `staging`, and `prod` stacks. The `local` context uses floci to emulate these resources.

**CDK app structure:**
- `infra/bin/app.ts` — entry point, reads `--context env=local|dev|staging|prod`
- `infra/lib/core-stack.ts` — VPC (2 AZs, private + public subnets), RDS Postgres 16 (Multi-AZ for prod, single for dev/staging), ElastiCache Redis 7 (cluster mode off), AWS Secrets Manager secrets (JWT key, OAuth credentials, DB password)

All secrets injected via Secrets Manager — no plaintext env vars in task definitions.

### Acceptance criteria

- [ ] `infra/` directory with `package.json`, `tsconfig.json`, `cdk.json`
- [ ] `CoreStack` deploys VPC with private/public subnets
- [ ] RDS Postgres 16 instance deployed in private subnet; connection string stored as Secrets Manager secret
- [ ] ElastiCache Redis 7 cluster deployed in private subnet
- [ ] Secrets Manager secrets created for: `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `DATABASE_URL`
- [ ] `cdk synth --context env=dev` produces valid CloudFormation without errors
- [ ] `cdk diff` works cleanly against a fresh account

### Blocked by

Issues B (Alembic), D (slim Dockerfile) — both must be complete before CDK references deployable images

---

## Issue F — CDK ECS Fargate service (backend + sidecar task, ALB)

**Labels:** `enhancement`

### What to build

Add the ECS Fargate service to the CDK app. The backend task definition contains two containers: the Python backend and the Spectral Sidecar. Both share the task network namespace (sidecar reachable at `http://localhost:3001`).

**Resources:**
- ECR repositories for `fastspec-backend` and `fastspec-sidecar`
- ECS Fargate cluster
- Task definition: 2 containers (backend + sidecar), secrets injected from Secrets Manager, `SPECTRAL_MODE=http`, `SPECTRAL_SIDECAR_URL=http://localhost:3001`, `CORS_ORIGINS` per environment
- Application Load Balancer routing `/api/*` and `/auth/*` to ECS service
- ECS service with desired count 1 (dev/staging) / 2 (prod)
- ALB health check target: `GET /health/ready` (or `GET /health` if readiness probe is not yet implemented)

### Acceptance criteria

- [ ] ECR repos created for backend and sidecar
- [ ] ECS Fargate task definition with 2-container configuration
- [ ] All secrets injected via `ecs.Secret.fromSecretsManager()` — no plaintext in task env
- [ ] `CORS_ORIGINS` set per environment context
- [ ] ALB routes `/api/*` and `/auth/*` to ECS service
- [ ] ECS service health check configured
- [ ] `cdk synth --context env=dev` produces valid CloudFormation
- [ ] ECS service deploys and backend `GET /health` returns 200 in dev environment

### Blocked by

Issue E (CDK core stack must exist)

---

## Issue G — CDK frontend hosting (S3 + CloudFront for frontend + landing-page)

**Labels:** `enhancement`

### What to build

Add S3 + CloudFront distributions for the frontend app and landing page to the CDK stack. Replaces Nginx-in-Docker for both services.

**Resources:**
- S3 bucket for frontend assets (Origin Access Control, versioning enabled)
- S3 bucket for landing-page assets
- CloudFront distribution for frontend: origin = S3 frontend bucket, default root object = `specs/index.html`
- CloudFront distribution for landing-page: origin = S3 landing-page bucket
- Cache policies: `no-store` for `index.html` files, `1y immutable` for hashed assets
- CDK deploy step uploads built assets to S3 and invalidates CloudFront cache

### Acceptance criteria

- [ ] Two S3 buckets created (frontend, landing-page) with OAC
- [ ] Two CloudFront distributions created
- [ ] Cache policies configured (no-store for HTML, immutable for assets)
- [ ] `cdk synth --context env=dev` produces valid CloudFormation
- [ ] Frontend accessible at CloudFront distribution URL after deploy

### Blocked by

Issue E (CDK core stack must exist)

---

## Issue H — CDK DNS + TLS (Route53 + ACM)

**Labels:** `enhancement`

### What to build

Wire up Route53 DNS records and ACM TLS certificates for all three AWS environments.

**Domains:**
- `dev.fastspec.kaseovo.com` → ALB (backend) + CloudFront (frontend)
- `staging.fastspec.kaseovo.com` → ALB + CloudFront
- `fastspec.kaseovo.com` → ALB + CloudFront

**Resources:**
- ACM certificate per environment (DNS validation via Route53)
- ALB HTTPS listener (443) with ACM cert; HTTP (80) redirects to HTTPS
- CloudFront aliases with ACM cert
- Route53 A records (alias) for each subdomain

Also register OAuth redirect URIs with Google and GitHub for each environment — document the required callback URLs in `docs/DEPLOYMENT.md`.

### Acceptance criteria

- [ ] ACM cert created and validated for each environment
- [ ] ALB HTTPS listener configured; HTTP → HTTPS redirect in place
- [ ] CloudFront distribution uses custom domain alias
- [ ] Route53 A records point to ALB and CloudFront
- [ ] `GET https://dev.fastspec.kaseovo.com/health` returns 200 after deploy
- [ ] `docs/DEPLOYMENT.md` updated with OAuth redirect URI registration instructions

### Blocked by

Issues F (ECS + ALB must exist), G (CloudFront distributions must exist)

---

## Issue I — ECS Alembic Migration Task (pre-deploy run task)

**Labels:** `enhancement`

### What to build

Replace the temporary `alembic upgrade head` startup step (introduced in Issue B) with a proper ECS Run Task that executes migrations before each service rollout. This is the Migration Task defined in `CONTEXT.md`.

The CDK deploy pipeline runs the migration task as a one-off ECS task in the same VPC/subnet as the service, using the backend container image. The main ECS service update only proceeds after the migration task completes successfully.

### Acceptance criteria

- [ ] CDK defines an ECS Run Task for `alembic upgrade head` using the backend image
- [ ] Migration task runs before ECS service update in `dev`, `staging`, `prod` contexts
- [ ] Migration task uses the same Secrets Manager secrets as the main service (DB credentials)
- [ ] `alembic upgrade head` removed from `backend/Dockerfile` CMD/startup
- [ ] Migration failure causes deploy pipeline to halt (non-zero exit)

### Blocked by

Issues B (Alembic must be configured), F (ECS cluster and task definition must exist)

---

## Issue J — CloudFront Function for SPA routing + OAuth callback

**Labels:** `enhancement`

### What to build

Implement a CloudFront Function that replicates the routing logic currently in `frontend/nginx.conf`. This is required because S3 cannot perform server-side rewrites natively.

**Routing rules to replicate:**
- `GET /specs/*` (any path) → fallback to `specs/index.html` if the object does not exist (SPA routing)
- `GET /specs` (exact) → 301 redirect to `/specs/`
- `GET /auth/callback*` → rewrite to `specs/index.html` (OAuth callback)
- Static assets (`*.js`, `*.css`, `*.svg`, etc.) → served directly from S3 with `Cache-Control: public, immutable, max-age=31536000`
- `specs/index.html` → `Cache-Control: no-store, no-cache, must-revalidate`

### Acceptance criteria

- [ ] CloudFront Function defined in CDK and associated with the frontend distribution
- [ ] `GET /specs/some/path` returns `specs/index.html` content (SPA fallback)
- [ ] `GET /auth/callback?code=xyz` returns `specs/index.html` content
- [ ] `GET /specs` returns 301 to `/specs/`
- [ ] Static asset responses include immutable cache header
- [ ] `index.html` response includes no-store cache header
- [ ] Verified against floci local stack

### Blocked by

Issue G (CloudFront distribution must exist in CDK)

---

## Issue K — Replace CI/CD pipeline with ECR push + CDK deploy

**Labels:** `enhancement`

### What to build

Replace the SSH-based deploy step in `.github/workflows/deploy-and-version.yml` with an AWS-native pipeline: build Docker images, push to ECR, upload static assets to S3, and run `cdk deploy`.

**New pipeline steps (replacing the SSH deploy step):**
1. Configure AWS credentials via GitHub OIDC (no stored access keys)
2. Build and push `fastspec-backend` image to ECR
3. Build and push `fastspec-sidecar` image to ECR
4. Build frontend and landing-page static assets
5. Upload assets to S3 buckets
6. Run `cdk deploy --context env=prod --require-approval never`
7. Invalidate CloudFront caches

Version bump and GitHub Release creation steps are retained unchanged.

### Acceptance criteria

- [ ] `deploy-and-version.yml` SSH deploy step removed
- [ ] GitHub OIDC role configured in CDK for CI/CD (no long-lived AWS credentials in GitHub secrets)
- [ ] Backend + sidecar images built and pushed to ECR in pipeline
- [ ] Frontend + landing-page assets uploaded to S3
- [ ] `cdk deploy --context env=prod` runs successfully in pipeline
- [ ] CloudFront invalidation triggered after asset upload
- [ ] Version bump and GitHub Release creation steps unchanged
- [ ] Manual `workflow_dispatch` trigger retained

### Blocked by

Issues F, G, H (full stack must be deployable), I (migration task must be wired)

---

## Issue L — Retire docker-compose, update README and DEPLOYMENT.md

**Labels:** `documentation`

### What to build

Remove `docker-compose.yml` and `docker-compose.dev.yml` and update all developer-facing documentation to use floci for local development.

**Changes:**
- Remove `docker-compose.yml` and `docker-compose.dev.yml` (or move to `archive/` with a deprecation note)
- Update `README.md`: replace `docker compose up` instructions with `floci up --context env=local`
- Update `docs/DEPLOYMENT.md`: document full local setup with floci, environment variable management via floci context, and OAuth redirect URI registration per environment
- Add `floci.config.ts` (or equivalent) at repo root referencing the `local` CDK context

### Acceptance criteria

- [ ] `docker-compose.yml` and `docker-compose.dev.yml` removed or archived
- [ ] `README.md` updated with floci setup instructions
- [ ] `docs/DEPLOYMENT.md` updated with per-environment setup guide
- [ ] `docs/DEPLOYMENT.md` includes OAuth redirect URI table for all 4 environments
- [ ] New contributor can run the full stack locally using only the README instructions

### Blocked by

Issues F, G (floci local context must be working end-to-end)
