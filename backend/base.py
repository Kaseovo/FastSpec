"""
SQLAlchemy declarative base for FastSpec.

Kept in its own module (rather than in database.py) so both models.py and
database.py can import Base without either one having to import from the
other first — avoiding a circular import between the two.
"""

from sqlalchemy.orm import declarative_base

Base = declarative_base()
