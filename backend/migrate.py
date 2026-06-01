#!/usr/bin/env python3
"""
Migration entrypoint for the ECS Fargate migration task.

Steps:
  1. Connect to the default 'postgres' database and create 'fastspec' if missing
     (RDS PostgreSQL does not create application databases automatically).
  2. Run `alembic upgrade head`.
"""
import os
import subprocess
import sys

import sqlalchemy


def build_admin_url() -> str:
    """Return a connection URL for the default 'postgres' admin database."""
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        # Replace the trailing database name with 'postgres'
        idx = database_url.rfind("/")
        return database_url[:idx] + "/postgres"

    db_endpoint = os.environ.get("DB_ENDPOINT", "postgres:5432")
    db_password = os.environ.get("DB_PASSWORD", "fastspec")
    parts = db_endpoint.split(":")
    db_host = parts[0]
    db_port = parts[1] if len(parts) > 1 else "5432"
    return f"postgresql://postgres:{db_password}@{db_host}:{db_port}/postgres"


def ensure_database() -> None:
    admin_url = build_admin_url()
    engine = sqlalchemy.create_engine(admin_url, isolation_level="AUTOCOMMIT")
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
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
    )
    sys.exit(result.returncode)


if __name__ == "__main__":
    print("=== FastSpec migration entrypoint ===")
    ensure_database()
    run_migrations()
