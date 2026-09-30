"""
Database configuration for FastSpec
"""

import os
import sys

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from config import settings

# Ensure models are imported so tables are created via Base.metadata.create_all
# Importing here avoids circular imports elsewhere when creating tables on startup
from models import APIKey, AuthToken, OpenAPISpec, SpecVersion, User

DATABASE_URL = settings.database_url
DATA_DIR = settings.data_dir

if not DATABASE_URL and DATA_DIR:
    # Self-hosted quickstart: a SQLite file next to the generated JWT secret
    # (see config.py). Postgres users set DATABASE_URL instead.
    os.makedirs(DATA_DIR, exist_ok=True)
    DATABASE_URL = f"sqlite:///{os.path.join(os.path.abspath(DATA_DIR), 'fastspec.db')}"

if not DATABASE_URL:
    # The hosted version loads DATABASE_URL from SSM at cold start
    # (lambda_handler.py); anything else must set it or FASTSPEC_DATA_DIR.
    print("FATAL: DATABASE_URL or FASTSPEC_DATA_DIR must be set", file=sys.stderr)
    sys.exit(1)

_connect_args: dict = {}
if "sqlite" in DATABASE_URL:
    _connect_args["check_same_thread"] = False
else:
    # Fail fast when the server is unreachable instead of hanging until a
    # timeout upstream; long enough for a serverless database (Neon) to
    # resume. TLS is the connection string's business (?sslmode=require).
    _connect_args["connect_timeout"] = 10

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


def describe_database_error(exc: BaseException | None) -> tuple[str, str]:
    """(code, message for people) for an error reaching or writing to the database.

    The hosted version's free Neon plan (docs/adr/0009-serverless-postgres.md)
    suspends the database for the rest of the month once its compute or
    data-transfer allowance is used up, and refuses writes once storage is
    full — worth saying plainly rather than "try again shortly".
    """
    orig = getattr(exc, "orig", None) or exc
    text = str(orig or "").lower()
    if "exceeded the compute time quota" in text or "exceeded the data transfer quota" in text:
        return (
            "database_quota_exceeded",
            "FastSpec has used up this month's free database allowance. "
            "It will be back at the start of next month.",
        )
    # 53100 disk_full — Neon: "could not extend file because project size limit … has been exceeded"
    if getattr(orig, "sqlstate", None) == "53100" or "project size limit" in text:
        return (
            "database_storage_full",
            "FastSpec's database is full: you can still open your specs, "
            "but changes can't be saved for now.",
        )
    return "database_unavailable", "The database is unavailable, please try again shortly."


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

