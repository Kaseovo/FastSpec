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

    # Relationship to custom tokens
    tokens = relationship(
        "CustomToken", back_populates="user", cascade="all, delete-orphan"
    )

    # Relationship to access/auth tokens
    auth_tokens = relationship(
        "AuthToken", back_populates="user", cascade="all, delete-orphan"
    )

    def revoke_token(self, db_session, jti: str) -> bool:
        """Revoke a specific CustomToken belonging to this user."""
        token = (
            db_session.query(CustomToken)
            .filter(CustomToken.jti == jti, CustomToken.user_id == self.id)
            .first()
        )
        if not token:
            return False
        token.revoked = True
        db_session.add(token)
        db_session.commit()
        return True

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


class CustomToken(Base):
    """Short-lived custom JWT tokens tied to a user for specific actions.

    actions are stored as JSON text for compatibility across DB backends.
    """

    __tablename__ = "custom_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    jti = Column(String(64), unique=True, index=True, nullable=False)
    actions = Column(Text, nullable=False)  # JSON-encoded array
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked = Column(Boolean, nullable=False, server_default="false", default=False)
    session_version = Column(Integer, nullable=False, server_default="0", default=0)

    # Relationship back to user
    user = relationship("User", back_populates="tokens")

    def get_actions(self):
        try:
            return json.loads(self.actions)
        except Exception:
            return []

    def set_actions(self, actions_list):
        self.actions = json.dumps(actions_list)

    def __repr__(self):
        return f"<CustomToken {self.jti} user={self.user_id} expires={self.expires_at} revoked={self.revoked}>"


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
