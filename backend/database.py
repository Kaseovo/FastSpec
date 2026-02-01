"""
Database configuration for FastSpec
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:////app/data/fastspec.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Ensure models are imported so tables are created via Base.metadata.create_all
# Importing here avoids circular imports elsewhere when creating tables on startup
from models import *  # noqa: F401,F403


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Create tables at module import time so startup creates needed tables
# This is a simple create_all approach; no migration system is used intentionally
Base.metadata.create_all(bind=engine)
