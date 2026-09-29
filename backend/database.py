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


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

