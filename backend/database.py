"""
Database configuration for FastSpec
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Define Base early to avoid circular import when models import Base
Base = declarative_base()

# Ensure models are imported so tables are created via Base.metadata.create_all
# Importing here avoids circular imports elsewhere when creating tables on startup
from models import User, OpenAPISpec, SpecVersion, AuthToken, APIKey

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://fastspec:fastspec@postgres:5432/fastspec"
)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

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


# Table creation is handled during application startup (in main.lifespan) to
# avoid duplicate initialization and ordering issues.
