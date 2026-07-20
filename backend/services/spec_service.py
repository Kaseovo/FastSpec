from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from models import OpenAPISpec, SpecVersion, User
from schemas import OpenAPISpecCreate, OpenAPISpecUpdate, OpenAPISpecResponse
from validation.validator import validate_openapi_spec
import uuid
from datetime import datetime, timezone


class SpecService:
    """Service layer for OpenAPI spec operations using PostgreSQL."""

    def __init__(self, db: Session):
        self.db = db

    def _build_response(
        self, spec: OpenAPISpec, current_version: Optional[SpecVersion] = None
    ) -> OpenAPISpecResponse:
        """Build an OpenAPISpecResponse from an ORM object, deriving title and spec_json from the current version."""
        if current_version is None:
            current_version = (
                self.db.query(SpecVersion)
                .filter(
                    SpecVersion.spec_id == spec.id,
                    SpecVersion.version == spec.version,
                )
                .first()
            )
        content = current_version.content if current_version else {}
        title = (
            content.get("info", {}).get("title", "Untitled") if content else "Untitled"
        )
        return OpenAPISpecResponse(
            id=spec.id,
            name=spec.name,
            title=title,
            version=spec.version,
            spec_json=content,
            user_id=spec.user_id,
            active_ruleset_id=spec.active_ruleset_id,
            created_at=spec.created_at or datetime.now(timezone.utc),
            updated_at=spec.updated_at or spec.created_at or datetime.now(timezone.utc),
        )

    def list_specs(
        self, user: User, skip: int = 0, limit: Optional[int] = None
    ) -> List[OpenAPISpecResponse]:
        # Single join instead of one SpecVersion query per spec (was N+1).
        query = (
            self.db.query(OpenAPISpec, SpecVersion)
            .join(
                SpecVersion,
                (SpecVersion.spec_id == OpenAPISpec.id)
                & (SpecVersion.version == OpenAPISpec.version),
            )
            .filter(OpenAPISpec.user_id == user.id)
            .order_by(OpenAPISpec.created_at.desc())
            .offset(skip)
        )
        if limit is not None:
            query = query.limit(limit)
        rows = query.all()
        return [self._build_response(spec, current_version) for spec, current_version in rows]

    def get_spec(self, user: User, spec_id: str) -> OpenAPISpecResponse:
        spec = (
            self.db.query(OpenAPISpec)
            .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == user.id)
            .first()
        )
        if not spec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Spec with id {spec_id} not found",
            )
        return self._build_response(spec)

    def create_spec(
        self, user: User, data: OpenAPISpecCreate, version: Optional[str] = None
    ) -> OpenAPISpecResponse:
        # Prefer the version carried in the create payload; the `version`
        # query param is accepted for backward compatibility only.
        version = data.version or version
        if not version:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A version is required (pass it in the request body)",
            )
        spec_json = data.spec_json
        if "info" not in spec_json:
            spec_json["info"] = {}
        spec_json["info"]["version"] = version
        is_valid, errors, warnings = validate_openapi_spec(spec_json)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Invalid OpenAPI specification",
                    "errors": [
                        {"field": e.field, "message": e.message} for e in errors
                    ],
                    "warnings": warnings,
                },
            )
        # Duplicate name check
        existing = (
            self.db.query(OpenAPISpec)
            .filter(OpenAPISpec.user_id == user.id, OpenAPISpec.name == data.name)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Spec with name '{data.name}' already exists",
            )

        spec_id = str(uuid.uuid4())
        spec_obj = OpenAPISpec(
            id=spec_id,
            name=data.name,
            version=version,
            user_id=user.id,
        )
        self.db.add(spec_obj)
        self.db.flush()

        initial_version = SpecVersion(
            spec_id=spec_id,
            version=version,
            content=spec_json,
            created_by=user.id,
        )
        self.db.add(initial_version)
        self.db.commit()
        self.db.refresh(spec_obj)

        return self._build_response(spec_obj)

    def update_spec(
        self, user: User, spec_id: str, data: OpenAPISpecUpdate
    ) -> OpenAPISpecResponse:
        spec = (
            self.db.query(OpenAPISpec)
            .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == user.id)
            .first()
        )
        if not spec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Spec with id {spec_id} not found",
            )
        if data.name is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only 'name' field can be updated via this endpoint",
            )
        # Optimistic concurrency: the client must be looking at the version
        # it's about to overwrite. This makes the `version` field on
        # OpenAPISpecUpdate load-bearing rather than an accepted-but-ignored
        # field the docstring merely claimed was enforced.
        if data.version != spec.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Spec has changed since it was loaded; refresh and try again",
            )
        # Duplicate name check
        conflict = (
            self.db.query(OpenAPISpec)
            .filter(
                OpenAPISpec.user_id == user.id,
                OpenAPISpec.name == data.name,
                OpenAPISpec.id != spec_id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Spec with name '{data.name}' already exists",
            )
        spec.name = data.name
        self.db.commit()
        self.db.refresh(spec)
        return self._build_response(spec)

    def delete_spec(self, user: User, spec_id: str) -> None:
        spec = (
            self.db.query(OpenAPISpec)
            .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == user.id)
            .first()
        )
        if not spec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Spec with id {spec_id} not found",
            )
        self.db.delete(spec)
        self.db.commit()
        return None
