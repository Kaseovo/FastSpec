"""
Alembic migration round-trips on every supported database
(docs/adr/0007-sqlite-and-postgres.md).

SQLite always runs. Postgres runs when TEST_POSTGRES_URL points at a server
the test may create/drop databases on (CI provides one), e.g.:

    TEST_POSTGRES_URL=postgresql://fastspec:fastspec@localhost:5432/fastspec \\
        python -m pytest tests/test_alembic_migrations.py -v
"""

import os
import subprocess
import sys

import pytest
import sqlalchemy
from sqlalchemy.engine import make_url

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL")
MIGRATION_DB_NAME = "fastspec_migration_test"

APP_TABLES = {
    "users",
    "openapi_specs",
    "spec_versions",
    "auth_tokens",
    "api_keys",
    "lint_rulesets",
}


@pytest.fixture(
    params=[
        "sqlite",
        pytest.param(
            "postgresql",
            marks=pytest.mark.skipif(not TEST_POSTGRES_URL, reason="TEST_POSTGRES_URL not set"),
        ),
    ]
)
def empty_db(request, tmp_path):
    """Yield the URL of a fresh, empty database."""
    if request.param == "sqlite":
        yield f"sqlite:///{tmp_path / 'migrations.db'}"
        return

    admin = sqlalchemy.create_engine(TEST_POSTGRES_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(sqlalchemy.text(f'DROP DATABASE IF EXISTS "{MIGRATION_DB_NAME}"'))
        conn.execute(sqlalchemy.text(f'CREATE DATABASE "{MIGRATION_DB_NAME}"'))
    yield make_url(TEST_POSTGRES_URL).set(database=MIGRATION_DB_NAME).render_as_string(
        hide_password=False
    )
    with admin.connect() as conn:
        conn.execute(sqlalchemy.text(f'DROP DATABASE IF EXISTS "{MIGRATION_DB_NAME}"'))
    admin.dispose()


def _alembic(*args: str, db_url: str, app_role_password: str | None = None) -> None:
    env = {**os.environ, "DATABASE_URL": db_url}
    # Without a password (self-hosted Postgres) the least-privilege role
    # migration is a no-op; with one (hosted AWS) it creates the role.
    env.pop("FASTSPEC_APP_DB_PASSWORD", None)
    if app_role_password is not None:
        env["FASTSPEC_APP_DB_PASSWORD"] = app_role_password
    result = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"alembic {' '.join(args)} failed:\n{result.stdout}\n{result.stderr}"
    )


def _tables(db_url: str) -> set[str]:
    engine = sqlalchemy.create_engine(db_url)
    try:
        return set(sqlalchemy.inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_upgrade_downgrade_upgrade_round_trip(empty_db):
    _alembic("upgrade", "head", db_url=empty_db)
    assert APP_TABLES <= _tables(empty_db)

    _alembic("downgrade", "base", db_url=empty_db)
    assert _tables(empty_db) & APP_TABLES == set()

    _alembic("upgrade", "head", db_url=empty_db)
    assert APP_TABLES <= _tables(empty_db)


def test_server_defaults_work_on_raw_inserts(empty_db):
    """Regression: the initial migration used a literal now(), which SQLite
    doesn't have, and 'false' boolean defaults stored as strings."""
    _alembic("upgrade", "head", db_url=empty_db)
    engine = sqlalchemy.create_engine(empty_db)
    with engine.begin() as conn:
        conn.execute(
            sqlalchemy.text(
                "INSERT INTO users (email, provider, provider_user_id) "
                "VALUES ('a@example.com', 'local', 'local')"
            )
        )
        user_id = conn.execute(sqlalchemy.text("SELECT id FROM users")).scalar()
        conn.execute(
            sqlalchemy.text(
                "INSERT INTO lint_rulesets (id, user_id, name) VALUES ('r1', :uid, 'Default')"
            ),
            {"uid": user_id},
        )
        created_at, is_default = conn.execute(
            sqlalchemy.text(
                "SELECT u.created_at, r.is_default FROM users u "
                "JOIN lint_rulesets r ON r.user_id = u.id"
            )
        ).one()
    engine.dispose()
    assert created_at is not None
    assert not is_default


def test_models_match_migrations(empty_db):
    """`alembic check` fails if models.py drifted from the migrations."""
    _alembic("upgrade", "head", db_url=empty_db)
    _alembic("check", db_url=empty_db)


def test_hosted_app_role_is_created_with_any_password(empty_db):
    """Hosted deployments create the least-privilege `fastspec_app` role.
    Role DDL can't take bind parameters, so the password must be quoted
    correctly whatever it contains."""
    if not empty_db.startswith("postgresql"):
        pytest.skip("roles only exist on Postgres")
    password = """it's:a %s $1 \\ "tricky" pw"""

    _alembic("upgrade", "head", db_url=empty_db, app_role_password=password)
    try:
        url = make_url(empty_db).set(username="fastspec_app", password=password)
        engine = sqlalchemy.create_engine(url)
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT count(*) FROM openapi_specs"))
        engine.dispose()
    finally:
        # The migration's downgrade drops the (cluster-wide) role again.
        _alembic("downgrade", "base", db_url=empty_db)


def test_urls_containing_percent_signs(tmp_path):
    """URL-encoded passwords contain "%", which Alembic's config parser treats
    as interpolation unless escaped."""
    (tmp_path / "100% sure").mkdir()
    # SQLAlchemy percent-decodes the path: "%25" → "%".
    _alembic("upgrade", "head", db_url=f"sqlite:///{tmp_path}/100%25 sure/fastspec.db")
    assert (tmp_path / "100% sure" / "fastspec.db").exists()
