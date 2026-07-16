#!/usr/bin/env python3
"""
Migration entrypoint, invoked in-process by backend/lambda_handler.py when
the Lambda is called with {"migrate": true} (see scripts/run-migrate.sh for
the historical ECS/local-CLI equivalent — there is no ECS run-task anymore).

Steps:
  1. Connect to the default 'postgres' database (as the RDS admin/`postgres`
     role) and create 'fastspec' if missing (RDS PostgreSQL does not create
     application databases automatically).
  2. Run `alembic upgrade head` — also as the admin role, connected to the
     'fastspec' database. This must stay admin/superuser: migrations include
     DDL and, as of
     backend/alembic/versions/b6f1d8c4a9e2_add_fastspec_app_role.py, creating
     the least-privilege `fastspec_app` runtime role itself — a role that by
     definition cannot grant itself the privileges needed to create or alter
     itself. The application's own runtime connection (backend/database.py)
     uses `fastspec_app`, never this admin connection.
"""
import os
import subprocess
import sys

import sqlalchemy


def build_admin_url(dbname: str = "postgres") -> str:
    """Return a connection URL for the RDS admin (`postgres`) role.

    Defaults to the default 'postgres' database (used to create/check for
    the 'fastspec' database). Pass dbname='fastspec' to get an admin
    connection to the application database itself, e.g. for running Alembic
    migrations that need elevated privileges (such as creating the
    fastspec_app role).
    """
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        # Replace the trailing database name with the requested one.
        idx = database_url.rfind("/")
        base = database_url[:idx]
        return f"{base}/{dbname}"

    db_endpoint = os.environ.get("DB_ENDPOINT", "postgres:5432")
    db_password = os.environ.get("DB_PASSWORD", "fastspec")
    parts = db_endpoint.split(":")
    db_host = parts[0]
    db_port = parts[1] if len(parts) > 1 else "5432"
    return f"postgresql://postgres:{db_password}@{db_host}:{db_port}/{dbname}?sslmode=require"


def ensure_database() -> None:
    admin_url = build_admin_url()
    engine = sqlalchemy.create_engine(admin_url, isolation_level="AUTOCOMMIT",
                                      connect_args={"sslmode": "require"})
    with engine.connect() as conn:
        result = conn.execute(
            sqlalchemy.text("SELECT 1 FROM pg_database WHERE datname = 'fastspec'")
        )
        if result.fetchone() is None:
            conn.execute(sqlalchemy.text("CREATE DATABASE fastspec"))
            print("Created database 'fastspec'.")
        else:
            print("Database 'fastspec' already exists.")
    engine.dispose()


def run_migrations() -> None:
    # Force alembic/env.py to use an admin connection to the 'fastspec'
    # database, regardless of what backend/database.py's DATABASE_URL
    # resolves to at runtime (which is the least-privilege fastspec_app
    # role — see backend/database.py and ADR-0002). Migrations need DDL
    # privileges, including creating the fastspec_app role itself.
    env = os.environ.copy()
    env["DATABASE_URL"] = build_admin_url(dbname="fastspec")
    # FASTSPEC_APP_DB_PASSWORD (if set) is inherited from the parent
    # environment unchanged — alembic/versions/b6f1d8c4a9e2_* reads it
    # directly to create/rotate the fastspec_app role's password.
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        env=env,
    )
    sys.exit(result.returncode)


if __name__ == "__main__":
    print("=== FastSpec migration entrypoint ===")
    ensure_database()
    run_migrations()
