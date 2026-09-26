# ADR-0007: Support SQLite and Postgres

**Status:** Accepted, implemented
**Date:** 2026-09-26

## Context

Production (the hosted version on RDS) has always used Postgres, while the
test suite ran on SQLite. For self-hosting, a Postgres-only app means two
containers, a compose file and two things to back up, even for one person
on a laptop. The most-tried install path for tools like this is a single
`docker run`.

## Decision

Support both:

- **SQLite** is the default when `DATABASE_URL` is unset and
  `FASTSPEC_DATA_DIR` is set (the Docker image sets it to `/data`):
  `sqlite:///$FASTSPEC_DATA_DIR/fastspec.db`. Connections enable
  `foreign_keys=ON` (matching Postgres semantics), WAL journaling and a
  busy timeout (`database.py`).
- **Postgres** whenever `DATABASE_URL` is set — the recommended setup for
  teams (`docker-compose.yml`) and what the hosted version uses.

Migrations must run on both:

- The initial migration's `server_default=sa.text('now()')` became
  `sa.func.now()`, and `'false'` boolean defaults became `sa.false()`
  (SQLite has no `now()`, and would store `'false'` as a truthy string).
  Both render identically on Postgres, so already-migrated databases are
  unaffected.
- `f3a9c2d1b7e4` adds its foreign-key column in batch mode (SQLite can't
  `ALTER` constraints), naming the FK with Postgres's own default name so
  fresh databases match existing ones.
- The least-privilege `fastspec_app` role migration (`b6f1d8c4a9e2`) is a
  no-op on SQLite, and on Postgres unless `FASTSPEC_APP_DB_PASSWORD` is set
  (the hosted deployment sets it; a self-hosted Postgres just connects as
  the `DATABASE_URL` owner). Its role DDL now quotes the password
  server-side with `format('%L')` — Postgres doesn't accept bind parameters
  in role DDL, and psycopg 3 binds server-side.

The Postgres driver moved from `psycopg2-binary` to `psycopg[binary]`
(psycopg 3). SQLAlchemy 2.1 maps `postgresql://` URLs to psycopg 3 by
default, so the unpinned `psycopg2-binary` requirement would have broken
the next image build.

## Consequences

- `docker run -v fastspec-data:/data …` is a complete install; backups are
  one file.
- CI runs the backend suite with a Postgres service:
  `tests/test_alembic_migrations.py` round-trips migrations, checks raw
  inserts against server defaults, runs `alembic check` (model/migration
  drift) on both databases, and exercises the hosted app-role path with a
  hostile password. Set `TEST_POSTGRES_URL` to run the Postgres variants
  locally.
- SQLite suits a single user or a small team. Heavy concurrent writing
  needs Postgres; the docs say so.
- New migrations must stay portable: use `sa.func`/`sa.true()`/`sa.false()`
  for defaults and `op.batch_alter_table` for constraint changes.
