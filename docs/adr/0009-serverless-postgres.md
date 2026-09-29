# ADR-0009: A serverless Postgres (Neon) instead of RDS for the hosted version

**Status:** Accepted, implemented
**Date:** 2026-09-29
**Supersedes:** ADR-0002 (there is no RDS instance left to expose)

## Context

The hosted version kept a `db.t3.micro` RDS instance that a "wake" stack
stopped after two hours without activity and started on demand. Even
stopped, it cost about $17 a month: RDS bills the provisioned disk (100 GB,
CDK's default), and backups, while the instance is stopped, and AWS restarts
a stopped instance after seven days. Waking it took one to three minutes,
which needed a wake page, a Wake Lambda with a shared secret, an auto-stop
Lambda, an activity timestamp and a "waking up" screen in the app — and
most of that machinery had bugs nobody noticed for months.

The goal for the hosted version is to cost next to nothing while nobody
uses it.

## Decision

The backend connects to any Postgres through `DATABASE_URL`. The hosted
version uses a project on [Neon](https://neon.com)'s free plan in AWS
Singapore (`aws-ap-southeast-1`, the region of the rest of the deployment):

- it scales to zero after 5 minutes idle and resumes on the next connection
  in under a second, so there is nothing to wake up or stop;
- the free plan (0.5 GB storage, 100 compute-hours a month, no credit card)
  is far more than FastSpec needs, and exceeding it pauses the database or
  blocks writes — it never produces a bill.

The connection string is a SecureString in SSM
(`/<env>/fastspec/database-url`), loaded at cold start like the other
secrets. The Data and Wake stacks, the wake page and the waking-up screen
are gone; database errors still answer 503 instead of 500.

The app connects as the Neon project's owner role. The least-privilege
`fastspec_app` role (ADR-0002) isn't created: its migration only runs when
`FASTSPEC_APP_DB_PASSWORD` is set.

## Consequences

- An idle month costs cents (old Lambda images, a Route 53 zone) instead of
  about $17.
- The first request after five idle minutes is slower by up to about a
  second; there is no multi-minute wake-up any more.
- The data lives with a third party, outside the AWS account, and depends on
  Neon keeping its free plan. Moving is a `pg_dump` / `pg_restore` and one
  SSM parameter away: any Postgres works.
- Self-hosting is unaffected (SQLite or any Postgres, ADR-0007).
