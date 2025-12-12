"""
SQLAlchemy models for FastSpec
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    """User model for authentication"""

    __tablename__ = "users"
    # Composite unique constraint ensures uniqueness of email per provider
    # This allows the same email to exist across different OIDC providers
    __table_args__ = (UniqueConstraint("email", "provider", name="uix_email_provider"),)

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    name = Column(String(255), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    provider = Column(String(50), nullable=False)  # 'google' or 'github'
    provider_user_id = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    # Relationship to specs
    specs = relationship(
        "OpenAPISpec", back_populates="owner", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User {self.email} ({self.provider})>"


class OpenAPISpec(Base):
    """OpenAPI Specification model"""

    __tablename__ = "openapi_specs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    spec_json = Column(Text, nullable=False)
    previous_spec_json = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    # Relationship to user
    owner = relationship("User", back_populates="specs")

    def __repr__(self):
        return f"<OpenAPISpec {self.name} ({self.title} v{self.version})>"
