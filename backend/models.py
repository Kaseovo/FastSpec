"""
SQLAlchemy models for FastSpec
"""

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from .database import Base


class OpenAPISpec(Base):
    """OpenAPI Specification model"""

    __tablename__ = "openapi_specs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    spec_json = Column(Text, nullable=False)
    previous_spec_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    def __repr__(self):
        return f"<OpenAPISpec {self.name} ({self.title} v{self.version})>"
