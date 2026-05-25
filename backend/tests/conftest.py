"""
Test configuration.

Sets required environment variables BEFORE any application module is imported,
then wires SQLAlchemy to an in-memory SQLite database and creates all tables.
"""

import os

# Must be set before config.py is imported (it calls sys.exit(1) if missing)
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault(
    "REDIS_HOST", "localhost"
)  # suppress any Redis connection attempts

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Now safe to import application modules
from database import Base, engine as _default_engine
import database as _db_module
import models  # noqa: F401 – ensure all models are registered on Base

# ---------------------------------------------------------------------------
# Override the engine with SQLite for tests
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite:///./test.db"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Patch the module-level engine and SessionLocal so all code that imports
# from database gets the test versions
_db_module.engine = test_engine
_db_module.SessionLocal = TestSessionLocal


@pytest.fixture(autouse=True, scope="session")
def _create_tables():
    """Create all tables once per test session, drop them at the end."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
