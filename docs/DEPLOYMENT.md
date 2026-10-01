# Deployment

There are two ways to run FastSpec in production:

- **Self-hosted** — the Docker image, with SQLite or Postgres. This is what
  almost everyone wants: see [SELF_HOSTING.md](SELF_HOSTING.md).
- **AWS serverless** — the setup behind the hosted version, described
  below. It costs next to nothing while nobody uses it, and needs an AWS
  account, a domain and a serverless Postgres database.

## AWS serverless deployment

Infrastructure is AWS CDK (TypeScript) in `infra/`, deployed by the manually
triggered **Deploy to AWS** GitHub workflow (`.github/workflows/deploy.yml`),
run from `main` — the deploy role only trusts that branch. Releases
(version tags, Docker images) are a separate workflow; see
[RELEASING.md](RELEASING.md).

| Stack | Contents |
|---|---|
| `FastSpec-Lambda-<env>` | The backend (`backend/Dockerfile.lambda`: FastAPI + MCP via Mangum) behind a Lambda Function URL. |
| `FastSpec-Cert-<env>` | ACM certificate (us-east-1, for CloudFront). |
| `FastSpec-Frontend-<env>` | S3 buckets for the SPA and for your own website, one CloudFront distribution routing `/specs*` → SPA, `/api*`, `/auth*`, `/mcp*` → Lambda, everything else → website bucket; Route 53 alias (unless the DNS is elsewhere, see below). |

The database isn't in AWS: it's any Postgres reachable over TLS, given as a
connection string. The hosted version uses [Neon](https://neon.com)'s free
plan, which scales to zero when idle and resumes on the first connection in
under a second ([ADR-0009](adr/0009-serverless-postgres.md)) — nothing has to
be woken up or stopped, and an idle month costs next to nothing.

### Settings

Nothing about a particular deployment is in the code. The CDK app reads
these from `--context` or environment variables, and the deploy workflow
sets them from GitHub **repository variables**:

| Variable | Example | Purpose |
|---|---|---|
| `FASTSPEC_DOMAIN` | `fastspec.example.com` | Public domain (required for `env=prod`). |
| `HOSTED_ZONE_NAME` | `example.com` | Only when that zone is a parent of the domain. |
| `FASTSPEC_EXTERNAL_DNS` | `true` | The domain's DNS is at another provider (Cloudflare, …): no Route 53 zone, see [DNS outside Route 53](#dns-outside-route-53). |
| `AWS_REGION` | `eu-west-1` | Region for everything except the CloudFront certificate (always `us-east-1`). |

Repository **secrets**: `AWS_ROLE_ARN` (the deploy role, assumed through
GitHub OIDC) and, unless `FASTSPEC_EXTERNAL_DNS`, `HOSTED_ZONE_ID` (the Route 53 zone holding the domain; without it, CDK looks the zone up, which needs AWS credentials at
synth time). The zone ID isn't sensitive as such, but Actions logs of a public
repository are public and GitHub masks secrets in them, not variables — the
workflow likewise masks the account ID and discards `cdk deploy` output, which
lists the stack outputs (function URLs). The role's trust
policy should only allow this repository's `main` branch:

```json
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": "repo:<owner>/FastSpec:ref:refs/heads/main"
  }
}
```

The secrets are SecureString parameters in SSM Parameter Store, which you
create once; only their *names* appear in CloudFormation, and the Lambda
reads them at cold start:

| Parameter | Value |
|---|---|
| `/<env>/fastspec/database-url` | Postgres connection string, `postgresql://user:password@host/fastspec?sslmode=require`. For Neon, the direct one (connection pooling off). |
| `/<env>/fastspec/secret-key` | `JWT_SECRET_KEY` (e.g. `openssl rand -hex 32`) |
| `/<env>/fastspec/google-client-id` | OIDC client ID |
| `/<env>/fastspec/google-client-secret` | OIDC client secret |

Sign-in uses Google through the generic OIDC flow (`AUTH_MODE=oidc`,
`OIDC_ISSUER=https://accounts.google.com`, set in
`infra/lib/lambda-stack.ts`). The Google OAuth client must list
`https://<domain>/auth/oidc/callback` as an authorized redirect URI.

To store a parameter without leaving its value in your shell history:

```bash
read -rs VALUE   # paste the value, then Enter
aws ssm put-parameter --type SecureString \
  --name /prod/fastspec/database-url --value "$VALUE" && unset VALUE
```

### Deploying

Run the **Deploy to AWS** workflow on `main`. It runs the test suites and
`cdk synth` first, then deploys the stacks in order (Lambda → Cert →
Frontend), runs database migrations by invoking the Lambda with
`{"migrate": true}`, uploads the SPA, and invalidates CloudFront.

### New-user notifications

The Lambda stack creates an SNS topic, and the backend publishes to it
whenever someone signs in for the first time: their email, name and when.
The stack has no subscription, so your address stays out of the public
template and the workflow's `cdk diff` output. Subscribe once, then click
the confirmation link AWS emails you:

```bash
TOPIC=$(aws cloudformation describe-stacks --stack-name FastSpec-Lambda-prod \
  --query "Stacks[0].Outputs[?OutputKey=='SignupTopicArn'].OutputValue" --output text)
aws sns subscribe --topic-arn "$TOPIC" --protocol email --notification-endpoint you@example.com
```

### DNS outside Route 53

With `FASTSPEC_EXTERNAL_DNS=true`, nothing is written to Route 53 and you
create two records at your DNS provider — as plain DNS (on Cloudflare: *DNS
only*, not proxied), since CloudFront is already the CDN:

| Type | Name | Value |
|---|---|---|
| CNAME | your domain | the `DistributionDomainName` output of `FastSpec-Frontend-<env>` |
| CNAME | the certificate's validation name | its validation value |

The validation record is listed by `aws acm describe-certificate --region
us-east-1` (`DomainValidationOptions`) or in the ACM console. On a first
deploy, the certificate stack waits until that record exists; ACM uses the
same record for every certificate of the domain, and to renew them.

Switching an existing deployment from Route 53 to external DNS replaces the
certificate. CloudFormation then retries deleting the old one, which
CloudFront still uses, until the deploy's one-hour AWS session expires and
the workflow fails at *Deploy CertStack*. The new certificate is in place by
then: deploy the frontend stack once more (the workflow, or `cdk deploy
FastSpec-Frontend-<env> --exclusively` with `--context certificateArn=` the
new `CertificateArn` output) and the old certificate is released and deleted.

### Database allowance

The hosted version runs on Neon's free plan: 100 compute-hours and 5 GB of
data transfer a month, 0.5 GB of storage. Neon sends no warning on that plan,
and its API only reports storage there, so the daily **Database usage**
workflow (`.github/workflows/neon-usage.yml`) fails — and GitHub emails you —
when storage passes 80%, or when the app can no longer reach its database
(compute or transfer used up: caught the day it happens). It needs two
repository secrets: `NEON_PROJECT_ID`, and `NEON_API_KEY`, a key limited to
that project (`neon api-keys create --name … --project-id …`). Compute usage
itself is only shown in Neon's console.

Anything that keeps querying the database keeps it awake — 100 compute-hours
at 0.25 CU is about 13 hours a day. Point uptime monitors at `/api/health`
(no database), not `/api/health/ready`.

The compute is fixed at 0.25 CU (plenty for FastSpec), so load can't burn
the hours faster. If an allowance runs out anyway, the app says so in a
banner instead of failing with generic errors:

- **compute or transfer used up** — the database is suspended until the
  next month (API: 503, `"code": "database_quota_exceeded"`);
- **storage full** — reading works, saving doesn't (507,
  `"database_storage_full"`) until space is freed, e.g. old spec versions.

Otherwise, wait for the monthly reset or move the Neon project to a paid
plan in Neon's console; no change to FastSpec is needed.

### Your website at `/`

Everything outside `/specs`, `/api`, `/auth` and `/mcp` is served from the
website bucket (`LandingBucketName` output), which this repository doesn't
fill. The hosted version deploys its marketing site there from a separate
repository. If you don't have one, upload an `index.html` that redirects to
`/specs/`.

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
