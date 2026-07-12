# ADR-0002: Public RDS ingress is an accepted tradeoff, not an oversight

**Status:** Accepted
**Date:** 2026-07-12

## Context

The principal-engineer code review (`docs/CODE_REVIEW.md`, §6 Security #1)
flagged that RDS is reachable on `0.0.0.0/0:5432`. This is true, and on its
face looks like a critical misconfiguration. This ADR records why it exists,
what mitigates it today, and what a real fix would require.

The backend Lambda (`infra/lib/lambda-stack.ts`, `BackendFn`) deliberately
runs **outside any VPC** — no `vpc` / `vpcSubnets` props are set on the
`DockerImageFunction`. That, combined with `natGateways: 0` on the VPC in
`DataStack` (ADR-0001), is what keeps this whole architecture near-zero-cost
when idle: no NAT Gateway hourly charge, no ENI cold-start latency for the
Lambda.

A VPC-less Lambda's outbound connections come from AWS's shared, rotating,
per-region IP pool — the same pool used by every other VPC-less Lambda in
that AWS region, across every AWS customer. There is no CIDR range you can
put in a security group ingress rule that admits "this Lambda" without also
admitting a large, unpredictable swath of unrelated AWS traffic. In other
words, **for this specific topology, "restrict ingress to the Lambda" and
"open to 0.0.0.0/0" are not meaningfully different in practice** — the only
real restriction is the port (5432) and requiring the correct credentials.

## Decision

Keep RDS `publiclyAccessible: true` with ingress open on 5432, and mitigate
via defense-in-depth instead of network ACLs:

1. **Encrypt in transit**: `rds.force_ssl=1` is enforced through a DB
   parameter group (`infra/lib/data-stack.ts`), so the server rejects any
   non-SSL connection outright — this cannot be bypassed by a
   misconfigured or compromised client.
2. **No hardcoded master password**: the RDS instance uses
   `rds.Credentials.fromGeneratedSecret('postgres')`, so CloudFormation
   generates a strong random password into Secrets Manager. Nothing in CDK
   ever writes a literal password string.
3. **Encrypt at rest**: `storageEncrypted: true` (already in place before
   this ADR).
4. **Track, don't ignore, the app-level gap**: `backend/database.py` (out of
   scope for this infra-focused pass — see the `TODO` comment left in
   `data-stack.ts`) still has a hardcoded `"fastspec"` fallback password and
   authenticates as the `postgres` superuser. Those are backend-code fixes,
   tracked separately, and should land before this ADR can be considered
   fully resolved rather than "mitigated."

## Alternatives considered

**Move the Lambda into the VPC + add a NAT Gateway, restrict RDS ingress to
the Lambda's security group.** This is the textbook fix and the one to do
if/when this project outgrows the "near-zero idle cost" constraint. Rejected
*for now* because a NAT Gateway costs ~$32/month plus per-GB processing
fees — more than the RDS instance itself costs when auto-stopped most of the
day. This is the right long-term direction; tracked as future work below.

**RDS Proxy + IAM database authentication.** Would let the Lambda
authenticate with short-lived IAM tokens instead of a static password, and
RDS Proxy can live in the VPC while still being reachable via a Lambda
outside it in some configurations — but RDS Proxy has an hourly cost per vCPU
of the underlying instance, and still generally expects VPC connectivity
from the client side for the proxy endpoint itself. Rejected for now on the
same cost-first grounds; worth revisiting together with the NAT Gateway
option above.

**Non-superuser application DB role.** Independently worthwhile (least
privilege — the app should not hold `CREATEDB`/`CREATEROLE` etc.) but is a
**backend** migration (new Alembic-managed role + grants, `database.py`
connection string change, `migrate.py` admin-vs-app URL split) and is
explicitly out of scope for this infra-only pass. Left as a TODO rather than
attempted as a half-migration.

## Consequences

- RDS stays reachable from the public internet on 5432; this is a conscious,
  documented risk acceptance, not an unnoticed gap.
- `rds.force_ssl=1` and the generated-secret master password are the two
  concrete infra-level improvements this ADR ships with.
- Follow-up work (tracked in `docs/CODE_REVIEW.md` §10): remove the
  backend-side hardcoded password fallback, migrate off the `postgres`
  superuser to a scoped app role, and revisit the VPC + NAT Gateway or RDS
  Proxy path once cost tolerance changes.
