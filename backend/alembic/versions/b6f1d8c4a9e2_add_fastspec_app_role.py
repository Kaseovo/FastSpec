"""add least-privilege fastspec_app role

Revision ID: b6f1d8c4a9e2
Revises: e21196ca7732
Create Date: 2026-07-16 00:00:00.000000

Creates a non-superuser Postgres role (`fastspec_app`) that the backend
should authenticate as at runtime instead of the RDS master `postgres` role
— see docs/adr/0002-rds-public-access-tradeoff.md ("Non-superuser
application DB role"). The role gets exactly what the app needs (CONNECT,
schema USAGE, CRUD on tables/sequences, including future ones via
ALTER DEFAULT PRIVILEGES) and explicitly nothing else: no CREATEDB,
CREATEROLE, or superuser.

This migration itself must always be run with an admin/superuser connection
(role creation and GRANT/ALTER DEFAULT PRIVILEGES require elevated
privileges) — see backend/migrate.py, which overrides DATABASE_URL to the
admin URL before invoking `alembic upgrade head` for exactly this reason.

The role's password is never hardcoded here. It is read at migration-run
time from the FASTSPEC_APP_DB_PASSWORD environment variable. When the role
doesn't exist yet, that variable decides whether it is created: set (the
hosted AWS deployment, which seeds it from SSM) → the role is created; unset
(a self-hosted Postgres, where the app simply connects as the DATABASE_URL
owner role) → this migration is a no-op. Once the role exists the variable
is optional — if present it rotates the password, if absent the migration
simply re-applies grants idempotently.

SQLite (the single-container quickstart) has no roles at all, so the
migration is skipped entirely there.
"""
import os
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b6f1d8c4a9e2'
down_revision: Union[str, None] = 'e21196ca7732'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ROLE_NAME = "fastspec_app"
PASSWORD_ENV_VAR = "FASTSPEC_APP_DB_PASSWORD"


def _role_exists(bind) -> bool:
    return (
        bind.execute(
            sa.text("SELECT 1 FROM pg_roles WHERE rolname = :role"),
            {"role": ROLE_NAME},
        ).scalar()
        is not None
    )


def _execute_with_password(bind, template: str, password: str) -> None:
    """Run CREATE/ALTER ROLE … PASSWORD with the password safely quoted.

    Postgres doesn't accept bind parameters in role DDL, and psycopg 3 binds
    server-side, so let Postgres quote the literal itself (format's %L).
    The resulting statement goes back through text() with colons escaped,
    so ":…" inside the password isn't read as a bind parameter and "%" is
    escaped for the driver's paramstyle.
    """
    statement = bind.execute(
        sa.text(
            "SELECT format(CAST(:template AS text), CAST(:role AS text), "
            "CAST(:password AS text))"
        ),
        {"template": template, "role": ROLE_NAME, "password": password},
    ).scalar()
    bind.execute(sa.text(statement.replace(":", "\\:")))


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    password = os.environ.get(PASSWORD_ENV_VAR)
    role_exists = _role_exists(bind)

    if not role_exists:
        if not password:
            # Self-hosted Postgres: no least-privilege role was requested.
            return
        # NOLOGIN-safe defaults: LOGIN so the app can authenticate, but never
        # SUPERUSER/CREATEDB/CREATEROLE — least privilege by construction.
        _execute_with_password(
            bind,
            "CREATE ROLE %I WITH LOGIN PASSWORD %L "
            "NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION",
            password,
        )
    elif password:
        # Role already exists — a password in the environment on a later run
        # is treated as an intentional rotation, not a requirement.
        _execute_with_password(bind, "ALTER ROLE %I WITH PASSWORD %L", password)
    # else: role already exists and no password was supplied — nothing to do
    # for the role itself; still fall through to (re-)apply grants below so
    # this migration is idempotent and safe to run repeatedly.

    # ── Grants: exactly what the app needs at runtime, nothing more ──────────
    bind.execute(sa.text(f"GRANT CONNECT ON DATABASE fastspec TO {ROLE_NAME}"))
    bind.execute(sa.text(f"GRANT USAGE ON SCHEMA public TO {ROLE_NAME}"))
    bind.execute(
        sa.text(
            "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public "
            f"TO {ROLE_NAME}"
        )
    )
    bind.execute(
        sa.text(
            f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {ROLE_NAME}"
        )
    )
    # Cover tables/sequences created by future migrations too (they'll be
    # owned by whatever admin role runs the migration, same as today).
    bind.execute(
        sa.text(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {ROLE_NAME}"
        )
    )
    bind.execute(
        sa.text(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
            f"GRANT USAGE, SELECT ON SEQUENCES TO {ROLE_NAME}"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql" or not _role_exists(bind):
        return

    bind.execute(
        sa.text(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
            f"REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM {ROLE_NAME}"
        )
    )
    bind.execute(
        sa.text(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
            f"REVOKE USAGE, SELECT ON SEQUENCES FROM {ROLE_NAME}"
        )
    )
    # DROP OWNED BY revokes remaining grants and drops any objects owned by
    # the role (there should be none — the role never creates anything), so
    # DROP ROLE below doesn't fail with "role has grants" / "role owns objects".
    bind.execute(sa.text(f"DROP OWNED BY {ROLE_NAME}"))
    bind.execute(sa.text(f"DROP ROLE IF EXISTS {ROLE_NAME}"))
