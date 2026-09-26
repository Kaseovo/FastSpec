"""
Database configuration for FastSpec
"""

import sys
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
import os

from base import Base
from config import settings

# Ensure models are imported so tables are created via Base.metadata.create_all
# Importing here avoids circular imports elsewhere when creating tables on startup
from models import User, OpenAPISpec, SpecVersion, AuthToken, APIKey

DATABASE_URL = settings.database_url
DATA_DIR = settings.data_dir

if not DATABASE_URL and DATA_DIR:
    # Self-hosted quickstart: a SQLite file next to the generated JWT secret
    # (see config.py). Postgres users set DATABASE_URL instead.
    os.makedirs(DATA_DIR, exist_ok=True)
    DATABASE_URL = f"sqlite:///{os.path.join(os.path.abspath(DATA_DIR), 'fastspec.db')}"

if not DATABASE_URL:
    # Assemble from separate CDK-injected vars (Lambda deployment).
    #
    # Runtime connects as the least-privilege `fastspec_app` role (see
    # backend/alembic/versions/b6f1d8c4a9e2_add_fastspec_app_role.py and
    # docs/adr/0002-rds-public-access-tradeoff.md), never as the RDS master
    # `postgres` role. `postgres`/admin credentials are only used by
    # backend/migrate.py to create the database and run migrations
    # (including the migration that creates this very role) — never by the
    # running application.
    db_endpoint = os.environ.get("DB_ENDPOINT", "postgres:5432")
    db_password = os.environ.get("FASTSPEC_APP_DB_PASSWORD")
    if not db_password:
        # Fail fast rather than silently connecting with a well-known
        # default password (mirrors the JWT_SECRET_KEY check in config.py) —
        # see docs/CODE_REVIEW.md §6 Critical #1.
        print(
            "FATAL: DATABASE_URL or FASTSPEC_APP_DB_PASSWORD environment "
            "variable is required",
            file=sys.stderr,
        )
        sys.exit(1)
    db_host, db_port = (db_endpoint.split(":") + ["5432"])[:2]
    DATABASE_URL = (
        f"postgresql://fastspec_app:{db_password}@{db_host}:{db_port}/fastspec"
    )

# Require SSL for RDS connections; ignored for local sqlite/postgres without SSL
_connect_args: dict = {}
if "sqlite" in DATABASE_URL:
    _connect_args["check_same_thread"] = False
elif "rds.amazonaws.com" in DATABASE_URL or os.environ.get("DB_ENDPOINT"):
    _connect_args["sslmode"] = "require"

engine = create_engine(DATABASE_URL, connect_args=_connect_args)

if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):
        # Enforce foreign keys like Postgres does, and use WAL so readers
        # don't block on the (single) writer.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Ensure the imported model classes are referenced so linters don't mark them as
# unused — we rely on importing these symbols to register tables on Base.metadata.
_ = (User, OpenAPISpec, SpecVersion, AuthToken, APIKey)


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

