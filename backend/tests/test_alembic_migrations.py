"""
Tests for Alembic migration round-trips.

Requires a running Postgres instance reachable at DATABASE_URL (defaults to
postgresql://fastspec:fastspec@localhost:5432/fastspec).

Run with:
    cd backend && python -m pytest tests/test_alembic_migrations.py -v
"""

import os
import subprocess
import sys

import pytest
import sqlalchemy

# Use a dedicated test database to avoid clobbering the main one
MIGRATION_TEST_DB_URL = os.environ.get(
    "MIGRATION_TEST_DB_URL",
    "postgresql://fastspec:fastspec@localhost:5432/fastspec_migration_test",
)

# Path to the backend directory (where alembic.ini lives)
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


POSTGRES_ADMIN_URL = os.environ.get(
    "POSTGRES_ADMIN_URL",
    "postgresql://fastspec:fastspec@localhost:5432/fastspec",
)


def _admin_engine():
    """Connect to the default 'fastspec' DB to create/drop the test DB."""
    return sqlalchemy.create_engine(POSTGRES_ADMIN_URL, isolation_level="AUTOCOMMIT")


@pytest.fixture(scope="module")
def migration_db():
    """Create an empty Postgres DB, yield its URL, then drop it."""
    db_name = "fastspec_migration_test"
    engine = _admin_engine()
    with engine.connect() as conn:
        conn.execute(sqlalchemy.text(f'DROP DATABASE IF EXISTS "{db_name}"'))
        conn.execute(sqlalchemy.text(f'CREATE DATABASE "{db_name}"'))
    yield MIGRATION_TEST_DB_URL
    with engine.connect() as conn:
        conn.execute(sqlalchemy.text(f'DROP DATABASE IF EXISTS "{db_name}"'))
    engine.dispose()


def _run_alembic(args: list[str], db_url: str) -> subprocess.CompletedProcess:
    """Run an alembic command against the given DB URL."""
    env = {**os.environ, "DATABASE_URL": db_url}
    result = subprocess.run(
        [sys.executable, "-m", "alembic"] + args,
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )
    return result


def test_upgrade_head_creates_tables(migration_db):
    """alembic upgrade head should succeed and create all expected tables."""
    result = _run_alembic(["upgrade", "head"], migration_db)
    assert result.returncode == 0, (
        f"alembic upgrade head failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )

    engine = sqlalchemy.create_engine(migration_db)
    inspector = sqlalchemy.inspect(engine)
    tables = set(inspector.get_table_names())
    engine.dispose()

    expected = {
        "users",
        "openapi_specs",
        "spec_versions",
        "auth_tokens",
        "api_keys",
        "lint_rulesets",
        "alembic_version",
    }
    assert expected.issubset(tables), (
        f"Missing tables after upgrade head: {expected - tables}"
    )


def test_downgrade_minus_one(migration_db):
    """alembic downgrade -1 should succeed and revert the initial migration."""
    result = _run_alembic(["downgrade", "-1"], migration_db)
    assert result.returncode == 0, (
        f"alembic downgrade -1 failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )

    engine = sqlalchemy.create_engine(migration_db)
    inspector = sqlalchemy.inspect(engine)
    tables = set(inspector.get_table_names())
    engine.dispose()

    # After downgrading the only migration, no app tables should remain
    app_tables = tables - {"alembic_version"}
    assert app_tables == set(), (
        f"Expected no app tables after downgrade, found: {app_tables}"
    )
