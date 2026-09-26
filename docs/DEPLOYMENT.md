# Deployment

There are two ways to run FastSpec in production:

- **Self-hosted** — the Docker image, with SQLite or Postgres. This is what
  almost everyone wants: see [SELF_HOSTING.md](SELF_HOSTING.md).
- **AWS serverless** — the setup behind the hosted version, described
  below. It's built for near-zero idle cost, and needs an AWS account, a
  Route 53 hosted zone and more moving parts.

## AWS serverless deployment

Infrastructure is AWS CDK (TypeScript) in `infra/`, deployed by the manually
triggered **Deploy to AWS** GitHub workflow (`.github/workflows/deploy.yml`),
run from `main` — the deploy role only trusts that branch. Releases
(version tags, Docker images) are a separate workflow; see
[RELEASING.md](RELEASING.md).

| Stack | Contents |
|---|---|
| `FastSpec-Data-<env>` | RDS PostgreSQL (publicly reachable, SSL enforced — see [ADR-0002](adr/0002-rds-public-access-tradeoff.md)), Secrets Manager secrets for the admin and `fastspec_app` roles. |
| `FastSpec-Lambda-<env>` | The backend (`backend/Dockerfile.lambda`: FastAPI + MCP via Mangum) behind a Lambda Function URL. |
| `FastSpec-Cert-<env>` | ACM certificate (us-east-1, for CloudFront). |
| `FastSpec-Frontend-<env>` | S3 buckets for the SPA and for your own website, one CloudFront distribution routing `/specs*` → SPA, `/api*`, `/auth*`, `/mcp*` → Lambda, everything else → website bucket; Route 53 alias. |
| `FastSpec-Wake-<env>` | Starts RDS on demand from `/wake.html` and stops it after inactivity (EventBridge, every 30 minutes). |

### Settings

Nothing about a particular deployment is in the code. The CDK app reads
these from `--context` or environment variables, and the deploy workflow
sets them from GitHub **repository variables**:

| Variable | Example | Purpose |
|---|---|---|
| `FASTSPEC_DOMAIN` | `fastspec.example.com` | Public domain (required for `env=prod`). |
| `HOSTED_ZONE_ID` | `Z0123456789ABC` | Route 53 zone holding the domain. Without it, CDK looks the zone up, which needs AWS credentials at synth time. |
| `HOSTED_ZONE_NAME` | `example.com` | Only when that zone is a parent of the domain. |
| `AWS_REGION` | `eu-west-1` | Region for everything except the CloudFront certificate (always `us-east-1`). |

Repository **secrets**: `AWS_ROLE_ARN` (the deploy role, assumed through
GitHub OIDC) and `WAKE_SECRET`. The role's trust policy should only allow
this repository's `main` branch:

```json
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": "repo:<owner>/FastSpec:ref:refs/heads/main"
  }
}
```

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
| `/<env>/fastspec/wake-secret` | Wake page secret |

Sign-in uses Google through the generic OIDC flow (`AUTH_MODE=oidc`,
`OIDC_ISSUER=https://accounts.google.com`, set in
`infra/lib/lambda-stack.ts`). The Google OAuth client must list
`https://<domain>/auth/oidc/callback` as an authorized redirect URI.

### Deploying

Run the **Deploy to AWS** workflow on `main`. It runs the test suites and
`cdk synth` first, then deploys the stacks in order (Data → Lambda → Cert →
Frontend → Wake), runs database migrations by invoking the Lambda with
`{"migrate": true}`, uploads the SPA and the wake page
(`infra/wake-page/wake.html`, with its URL and secret filled in), and
invalidates CloudFront.

### Your website at `/`

Everything outside `/specs`, `/api`, `/auth` and `/mcp` is served from the
website bucket (`LandingBucketName` output), which this repository doesn't
fill. The hosted version deploys its marketing site there from a separate
repository. If you don't have one, upload an `index.html` that redirects to
`/specs/`. Whatever syncs that bucket must leave `wake.html` in place.

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
