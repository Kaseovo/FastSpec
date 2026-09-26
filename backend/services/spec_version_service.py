"""
Service layer for OpenAPI spec version operations.

Extracted from routers/specs.py, which previously did raw ORM queries,
ownership checks, and commit management inline across six endpoints (see
docs/CODE_REVIEW.md §1/§11). Two of those endpoints (delete_version,
publish_version) mutated the session but never called db.commit(), so
get_db's rollback-on-close silently discarded the change. Centralizing
commit discipline here in one place is what prevents that bug class.

version_or_404 is the single canonical version lookup (tries UUID id, then
falls back to the version string) used by every version endpoint, replacing
three different lookup variants that previously disagreed with each other
(GET accepted UUID-or-version, DELETE accepted version-string-only,
update_version used yet another helper).
"""

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models import OpenAPISpec, SpecVersion, User


class SpecVersionService:
    def __init__(self, db: Session):
        self.db = db

    # --- resolution helpers -------------------------------------------------

    def owned_spec_or_404(self, user: User, spec_id: str) -> OpenAPISpec:
        """Verify the spec exists and belongs to the current user.

        Every version lookup below is scoped through a spec resolved here,
        so ownership is established once and version-level permission
        checks against "who created this version" are unreachable/moot —
        removed rather than kept as dead code (docs/CODE_REVIEW.md §2).
        """
        spec = (
            self.db.query(OpenAPISpec)
            .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == user.id)
            .first()
        )
        if not spec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Spec not found"
            )
        return spec

    def version_or_404(self, spec_id: str, version_key: str) -> SpecVersion:
        """Canonical version lookup: try UUID id first, then version string."""
        try:
            val = str(uuid.UUID(version_key))
            ver = (
                self.db.query(SpecVersion)
                .filter(SpecVersion.id == val, SpecVersion.spec_id == spec_id)
                .first()
            )
            if ver:
                return ver
        except ValueError:
            pass

        ver = (
            self.db.query(SpecVersion)
            .filter(SpecVersion.spec_id == spec_id, SpecVersion.version == version_key)
            .first()
        )
        if not ver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Spec version not found"
            )
        return ver

    # --- operations ----------------------------------------------------------

    def list_versions(self, user: User, spec_id: str) -> list[SpecVersion]:
        self.owned_spec_or_404(user, spec_id)
        return (
            self.db.query(SpecVersion)
            .filter(SpecVersion.spec_id == spec_id)
            .order_by(SpecVersion.created_at.desc())
            .all()
        )

    def get_version(self, user: User, spec_id: str, version_key: str) -> SpecVersion:
        self.owned_spec_or_404(user, spec_id)
        return self.version_or_404(spec_id, version_key)

    def create_version(
        self,
        user: User,
        spec_id: str,
        version: str,
        content: dict[str, Any],
        meta: dict[str, Any] | None,
    ) -> SpecVersion:
        spec = self.owned_spec_or_404(user, spec_id)
        if not version or not isinstance(content, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload"
            )

        new_version = SpecVersion(
            spec_id=spec_id,
            version=version,
            content=content,
            meta=meta,
            created_by=user.id,
        )
        try:
            self.db.add(new_version)
            spec.version = version
            self.db.add(spec)
            self.db.commit()
            self.db.refresh(new_version)
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Version already exists for this spec",
            ) from exc
        return new_version

    def update_version(
        self,
        user: User,
        spec_id: str,
        version_key: str,
        version: str,
        content: dict[str, Any],
        meta: dict[str, Any] | None,
    ) -> SpecVersion:
        self.owned_spec_or_404(user, spec_id)
        ver = self.version_or_404(spec_id, version_key)
        if not version or not isinstance(content, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload"
            )
        ver.version = version
        ver.content = content
        if meta is not None:
            ver.meta = meta
        self.db.add(ver)
        self.db.commit()
        self.db.refresh(ver)
        return ver

    def delete_version(self, user: User, spec_id: str, version_key: str) -> None:
        spec = self.owned_spec_or_404(user, spec_id)
        ver = self.version_or_404(spec_id, version_key)
        if spec.version == ver.version:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete the currently published version",
            )
        self.db.delete(ver)
        self.db.commit()

    def publish(self, user: User, spec_id: str, version_key: str) -> SpecVersion:
        spec = self.owned_spec_or_404(user, spec_id)
        ver = self.version_or_404(spec_id, version_key)
        spec.version = ver.version
        self.db.add(spec)
        self.db.commit()
        self.db.refresh(ver)
        return ver

    def resolve_base_version(self, user: User, spec_id: str, base_key: str) -> SpecVersion:
        """Resolve a 'base' compare key, honoring the 'live'/'latest' special tokens."""
        spec = self.owned_spec_or_404(user, spec_id)
        if base_key in ("live", "latest"):
            return self.version_or_404(spec_id, spec.version)
        return self.version_or_404(spec_id, base_key)
