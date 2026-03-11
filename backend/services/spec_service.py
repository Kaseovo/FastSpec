import json
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import OpenAPISpec, SpecVersion, User
from schemas import OpenAPISpecCreate, OpenAPISpecUpdate
from validation.validator import validate_openapi_spec


class SpecService:
    """Service layer for OpenAPI spec operations.

    Methods raise HTTPException with the same status codes/messages used by the
    routes so behavior remains unchanged. The db Session is injected to allow
    easy mocking in unit tests.
    """

    def __init__(self, db: Session):
        self.db = db

    def list_specs(self, user: User) -> List[dict]:
        specs = (
            self.db.query(OpenAPISpec)
            .filter(OpenAPISpec.user_id == user.id)
            .order_by(OpenAPISpec.created_at.desc())
            .all()
        )
        result = []
        for spec in specs:
            result.append(
                {
                    "id": spec.id,
                    "name": spec.name,
                    "title": spec.title,
                    "version": spec.version,
                    "spec_json": json.loads(spec.spec_json),
                    "user_id": spec.user_id,
                    "created_at": spec.created_at,
                    "updated_at": spec.updated_at,
                }
            )
        return result

    def get_spec(self, user: User, spec_id: str) -> dict:
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
        return {
            "id": spec.id,
            "name": spec.name,
            "title": spec.title,
            "version": spec.version,
            "spec_json": json.loads(spec.spec_json),
            "user_id": spec.user_id,
            "created_at": spec.created_at,
            "updated_at": spec.updated_at,
        }

    def create_spec(self, user: User, data: OpenAPISpecCreate, version: str) -> dict:
        # Enforce version presence
        if not version:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Version query parameter is required",
            )

        spec_json = data.spec_json
        if "info" not in spec_json:
            spec_json["info"] = {}
        spec_json["info"]["version"] = version

        # Validate
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

        # duplicate name check
        existing = (
            self.db.query(OpenAPISpec)
            .filter(OpenAPISpec.name == data.name, OpenAPISpec.user_id == user.id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Spec with name '{data.name}' already exists",
            )

        title = spec_json.get("info", {}).get("title", "Untitled")
        version_val = spec_json.get("info", {}).get("version", "1.0.0")

        new_spec = OpenAPISpec(
            name=data.name,
            title=title,
            version=version_val,
            spec_json=json.dumps(spec_json),
            user_id=user.id,
        )
        self.db.add(new_spec)
        self.db.commit()
        self.db.refresh(new_spec)

        initial_version = SpecVersion(
            spec_id=new_spec.id,
            version=version_val,
            content=spec_json,
            created_by=user.id,
            is_published=True,
        )
        self.db.add(initial_version)
        self.db.commit()
        self.db.refresh(initial_version)

        return {
            "id": new_spec.id,
            "name": new_spec.name,
            "title": new_spec.title,
            "version": new_spec.version,
            "spec_json": spec_json,
            "user_id": new_spec.user_id,
            "created_at": new_spec.created_at,
            "updated_at": new_spec.updated_at,
            "initial_version": {
                "id": initial_version.id,
                "version": initial_version.version,
                "content": initial_version.content,
                "created_by": initial_version.created_by,
                "created_at": initial_version.created_at,
                "is_published": initial_version.is_published,
            },
        }

    def update_spec(self, user: User, spec_id: str, data: OpenAPISpecUpdate) -> dict:
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
        new_name = data.name
        existing = (
            self.db.query(OpenAPISpec)
            .filter(
                OpenAPISpec.name == new_name,
                OpenAPISpec.id != spec_id,
                OpenAPISpec.user_id == user.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Spec with name '{new_name}' already exists",
            )
        spec.name = new_name
        self.db.commit()
        self.db.refresh(spec)
        return {
            "id": spec.id,
            "name": spec.name,
            "title": spec.title,
            "version": spec.version,
            "spec_json": json.loads(spec.spec_json),
            "user_id": spec.user_id,
            "created_at": spec.created_at,
            "updated_at": spec.updated_at,
        }

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
