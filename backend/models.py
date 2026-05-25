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
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import json
import uuid


class User(Base):
    """User model for authentication"""

    __tablename__ = "users"
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

    session_version = Column(Integer, nullable=False, server_default="0", default=0)

    specs = relationship(
        "OpenAPISpec", back_populates="owner", cascade="all, delete-orphan"
    )

    lint_ruleset = relationship(
        "UserLintRuleset",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    auth_tokens = relationship(
        "AuthToken", back_populates="user", cascade="all, delete-orphan"
    )

    api_keys = relationship(
        "APIKey", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User {self.email} ({self.provider})>"


class OpenAPISpec(Base):
    """OpenAPI Specification model"""

    __tablename__ = "openapi_specs"

    id = Column(
        String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    name = Column(String(255), index=True, nullable=False)
    version = Column(String(50), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    owner = relationship("User", back_populates="specs")

    # Relationship to versions (one-to-many), ordered by created_at desc
    versions = relationship(
        "SpecVersion",
        back_populates="spec",
        cascade="all, delete-orphan",
        order_by="SpecVersion.created_at.desc()",
    )

    def __repr__(self):
        return f"<OpenAPISpec {self.name} (v{self.version})>"


class SpecVersion(Base):
    """Versioned snapshot of an OpenAPI spec"""

    __tablename__ = "spec_versions"
    __table_args__ = (
        UniqueConstraint(
            "spec_id", "version", name="uix_spec_versions_spec_id_version"
        ),
    )

    # Use String UUID representation to align with other UUID-like ids used elsewhere
    id = Column(
        String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    spec_id = Column(
        String(36), ForeignKey("openapi_specs.id"), nullable=False, index=True
    )
    version = Column(String(50), nullable=False)
    content = Column(JSON, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    spec = relationship("OpenAPISpec", back_populates="versions")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<SpecVersion {self.id} spec_id={self.spec_id} version={self.version}>"


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


class APIKey(Base):
    """Long-lived editable API key stored as a hash."""

    __tablename__ = "api_keys"

    id = Column(
        String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    # Short non-secret prefix used for lookup (nullable until migration completes)
    key_prefix = Column(String(16), index=True, nullable=True)
    token_hash = Column(String(255), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    actions = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked = Column(Boolean, nullable=False, server_default="false", default=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="api_keys")

    def get_actions(self):
        try:
            return json.loads(self.actions)
        except Exception:
            return []

    def set_actions(self, actions_list):
        self.actions = json.dumps(actions_list)

    def __repr__(self):
        return f"<APIKey id={self.id} user={self.user_id} expires={self.expires_at} revoked={self.revoked}>"


class UserLintRuleset(Base):
    """Per-user global Spectral lint ruleset.

    Stores either structured rule definitions (rules_json), a raw YAML
    override (raw_yaml), or both. When raw_yaml is present it takes
    precedence at lint time and is written directly to the temp ruleset
    file. rules_json is kept for UI round-tripping even when raw_yaml is set.
    """

    __tablename__ = "user_lint_rulesets"

    id = Column(
        String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    user_id = Column(
        Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True
    )
    # Structured Rules: list of rule dicts built via the rule-form UI
    rules_json = Column(JSON, nullable=True)
    # Raw Ruleset Override: user-authored Spectral YAML (takes precedence over rules_json)
    raw_yaml = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    user = relationship("User", back_populates="lint_ruleset")

    def __repr__(self) -> str:
        return f"<UserLintRuleset user_id={self.user_id}>"
