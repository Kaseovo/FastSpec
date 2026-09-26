# Deployment

There are two ways to run FastSpec in production:

- **Self-hosted** — the Docker image, with SQLite or Postgres. This is what
  almost everyone wants: see [SELF_HOSTING.md](SELF_HOSTING.md).
- **AWS serverless** — the setup behind the hosted version, described
  below. It's built for near-zero idle cost, and needs an AWS account, a
  Route 53 hosted zone and more moving parts.

## AWS serverless deployment

Infrastructure is AWS CDK (TypeScript) in `infra/`, deployed by the manually
triggered **Deploy and Version** GitHub workflow
(`.github/workflows/deploy-and-version.yml`).

| Stack | Contents |
|---|---|
| `FastSpec-Data-<env>` | RDS PostgreSQL (publicly reachable, SSL enforced — see [ADR-0002](adr/0002-rds-public-access-tradeoff.md)), Secrets Manager secrets for the admin and `fastspec_app` roles. |
| `FastSpec-Lambda-<env>` | The backend (`backend/Dockerfile.lambda`: FastAPI + MCP via Mangum) behind a Lambda Function URL. |
| `FastSpec-Cert-<env>` | ACM certificate (us-east-1, for CloudFront). |
| `FastSpec-Frontend-<env>` | S3 buckets for the SPA and the landing page, one CloudFront distribution routing `/specs*` → SPA, `/api*`, `/auth*`, `/mcp*` → Lambda, everything else → landing page; Route 53 alias. |
| `FastSpec-Wake-<env>` | Starts RDS on demand from a wake page and stops it after inactivity. |

### Secrets

The Lambda reads these SecureString parameters from SSM Parameter Store at
cold start (`backend/lambda_handler.py`); only their *names* appear in
CloudFormation:

| Parameter | Value |
|---|---|
| `/<env>/fastspec/secret-key` | `JWT_SECRET_KEY` |
| `/<env>/fastspec/db-password` | RDS admin password (migrations only) |
| `/<env>/fastspec/app-db-password` | `fastspec_app` role password (runtime) |
| `/<env>/fastspec/google-client-id` | OIDC client ID |
| `/<env>/fastspec/google-client-secret` | OIDC client secret |

Sign-in uses Google through the generic OIDC flow (`AUTH_MODE=oidc`,
`OIDC_ISSUER=https://accounts.google.com`, set in
`infra/lib/lambda-stack.ts`). The Google OAuth client must list
`https://<domain>/auth/oidc/callback` as an authorized redirect URI.

### Deploying

The workflow runs the test suites and `cdk synth` first, then deploys the
stacks in order (Data → Lambda → Cert → Frontend → Wake), runs database
migrations by invoking the Lambda with `{"migrate": true}`, builds and
uploads the SPA and landing page, and invalidates CloudFront. It needs the
`AWS_ROLE_ARN` (OIDC-federated deploy role) and `WAKE_SECRET` repository
secrets.

### Working on the infrastructure locally

The same stacks can be deployed against floci (the `floci/floci` image),
a local AWS emulator ([ADR-0001](adr/0001-replace-docker-compose-with-cdk-floci.md)):

```bash
make floci-up        # start floci
make floci-secrets   # seed .env into floci SSM
make floci-infra     # cdk deploy --all --context env=local
make floci-logs      # tail the backend Lambda logs
```

This is only needed when changing `infra/`. For application work, use
`make dev` (see the README).
