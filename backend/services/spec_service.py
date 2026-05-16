from typing import List, Optional
import json
from fastapi import HTTPException, status
from auth.redis_client import get_redis
from models import User
from schemas import OpenAPISpecCreate, OpenAPISpecUpdate, OpenAPISpecResponse
from validation.validator import validate_openapi_spec
import uuid
from datetime import datetime


class SpecService:
    """Service layer for OpenAPI spec operations using Redis.
    Methods raise HTTPException with the same status codes/messages used by the
    routes so behavior remains unchanged.
    """

    def __init__(self):
        self.redis = get_redis()

    def _spec_key(self, user_id: int, spec_id: str) -> str:
        return f"spec:{user_id}:{spec_id}"

    def _user_specs_set(self, user_id: int) -> str:
        return f"specs:{user_id}"

    def list_specs(self, user: User) -> List[OpenAPISpecResponse]:
        spec_ids = self.redis.smembers(self._user_specs_set(user.id))
        specs = []
        for spec_id in spec_ids:
            data = self.redis.get(self._spec_key(user.id, spec_id))
            if data:
                specs.append(OpenAPISpecResponse.model_validate_json(data))
        # Sort by created_at desc
        specs.sort(key=lambda s: s.created_at, reverse=True)
        return specs

    def get_spec(self, user: User, spec_id: str) -> OpenAPISpecResponse:
        data = self.redis.get(self._spec_key(user.id, spec_id))
        if not data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Spec with id {spec_id} not found",
            )
        return OpenAPISpecResponse.model_validate_json(data)

    def create_spec(
        self, user: User, data: OpenAPISpecCreate, version: str
    ) -> OpenAPISpecResponse:
        if not version:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Version query parameter is required",
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
        for sid in self.redis.smembers(self._user_specs_set(user.id)):
            existing = self.redis.get(self._spec_key(user.id, sid))
            if existing:
                existing_obj = OpenAPISpecResponse.model_validate_json(existing)
                if existing_obj.name == data.name:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Spec with name '{data.name}' already exists",
                    )
        spec_id = str(uuid.uuid4())
        now = datetime.utcnow()
        title = spec_json.get("info", {}).get("title", "Untitled")
        version_val = spec_json.get("info", {}).get("version", "1.0.0")
        spec_obj = OpenAPISpecResponse(
            id=spec_id,
            name=data.name,
            title=title,
            version=version_val,
            spec_json=spec_json,
            user_id=user.id,
            created_at=now,
            updated_at=now,
        )
        self.redis.set(self._spec_key(user.id, spec_id), spec_obj.model_dump_json())
        self.redis.sadd(self._user_specs_set(user.id), spec_id)
        return spec_obj

    def update_spec(
        self, user: User, spec_id: str, data: OpenAPISpecUpdate
    ) -> OpenAPISpecResponse:
        raw = self.redis.get(self._spec_key(user.id, spec_id))
        if not raw:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Spec with id {spec_id} not found",
            )
        spec = OpenAPISpecResponse.model_validate_json(raw)
        if data.name is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only 'name' field can be updated via this endpoint",
            )
        # Duplicate name check
        for sid in self.redis.smembers(self._user_specs_set(user.id)):
            if sid == spec_id:
                continue
            existing = self.redis.get(self._spec_key(user.id, sid))
            if existing:
                existing_obj = OpenAPISpecResponse.model_validate_json(existing)
                if existing_obj.name == data.name:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Spec with name '{data.name}' already exists",
                    )
        spec.name = data.name
        spec.updated_at = datetime.utcnow()
        self.redis.set(self._spec_key(user.id, spec_id), spec.model_dump_json())
        return spec

    def delete_spec(self, user: User, spec_id: str) -> None:
        removed = self.redis.delete(self._spec_key(user.id, spec_id))
        self.redis.srem(self._user_specs_set(user.id), spec_id)
        if not removed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Spec with id {spec_id} not found",
            )
        return None
