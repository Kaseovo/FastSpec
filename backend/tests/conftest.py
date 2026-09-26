"""
Test configuration.

Sets required environment variables BEFORE any application module is imported,
then wires SQLAlchemy to an in-memory SQLite database and creates all tables.
"""

import os

# Must be set before config.py is imported (it calls sys.exit(1) if missing).
# Ignore the developer's own .env so it can't change test behaviour.
os.environ["FASTSPEC_ENV_FILE"] = os.devnull
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
# Tests default to single-user mode; OIDC tests switch settings per test.
os.environ.setdefault("AUTH_MODE", "none")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import database as _db_module
import models  # noqa: F401 – ensure all models are registered on Base

# Now safe to import application modules
from base import Base

# ---------------------------------------------------------------------------
# Override the engine with an in-memory SQLite DB for tests. StaticPool keeps
# every connection on the same in-memory database for the life of the test
# session (a plain in-memory URL would give each connection its own,
# throwing away tables between calls). This also stops `test.db` files from
# being left behind in the repo root — see docs/CODE_REVIEW.md §5.
# ---------------------------------------------------------------------------

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
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


@pytest.fixture
def fake_spectral_client():
    """Return a default FakeSpectralClient (score=100, no issues)."""
    from tests.fakes import FakeSpectralClient

    return FakeSpectralClient()
