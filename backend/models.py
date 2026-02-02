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
    Boolean,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import json
import uuid


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

    # Session version for fast revocation of short-lived tokens
    session_version = Column(Integer, nullable=False, server_default="0", default=0)

    # Relationship to specs
    specs = relationship(
        "OpenAPISpec", back_populates="owner", cascade="all, delete-orphan"
    )

    # Relationship to access/auth tokens
    auth_tokens = relationship(
        "AuthToken", back_populates="user", cascade="all, delete-orphan"
    )

    # Relationship to refresh tokens
    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
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


class AuthToken(Base):
    """Persistent stored JWTs for access sessions (supports revocation)."""

    __tablename__ = "auth_tokens"

    id = Column(
        String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    jti = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked = Column(Boolean, nullable=False, server_default="false", default=False)

    user = relationship("User", back_populates="auth_tokens")

    def __repr__(self):
        return f"<AuthToken {self.jti} user={self.user_id} expires={self.expires_at} revoked={self.revoked}>"


class RefreshToken(Base):
    """Long-lived editable refresh token stored as a hash."""

    __tablename__ = "refresh_tokens"

    id = Column(
        String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    token_hash = Column(String(255), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    actions = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked = Column(Boolean, nullable=False, server_default="false", default=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="refresh_tokens")

    def get_actions(self):
        try:
            return json.loads(self.actions)
        except Exception:
            return []

    def set_actions(self, actions_list):
        self.actions = json.dumps(actions_list)

    def __repr__(self):
        return f"<RefreshToken id={self.id} user={self.user_id} expires={self.expires_at} revoked={self.revoked}>"
