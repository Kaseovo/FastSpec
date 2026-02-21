from fastapi import Body

"""
API routes for OpenAPI specifications
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Dict, Any, Optional
import json
import uuid
import logging

from database import get_db
from models import OpenAPISpec, User, SpecVersion
from schemas import (
    OpenAPISpecCreate,
    OpenAPISpecUpdate,
    OpenAPISpecResponse,
    ValidationResponse,
    SpecVersionCreate,
    SpecVersionResponse,
)
from auth.dependencies import get_current_user
from validation.validator import validate_openapi_spec
from validation.diff_utils import compare_specs, generate_markdown_report


router = APIRouter()
logger = logging.getLogger(__name__)


# --- existing endpoints (unchanged) ---
@router.get("/", response_model=List[OpenAPISpecResponse])
async def list_specs(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """List all OpenAPI specifications for the current user"""
    specs = (
        db.query(OpenAPISpec)
        .filter(OpenAPISpec.user_id == current_user.id)
        .order_by(OpenAPISpec.created_at.desc())
        .all()
    )

    # Convert spec_json from string to dict
    result = []
    for spec in specs:
        spec_dict = {
            "id": spec.id,
            "name": spec.name,
            "title": spec.title,
            "version": spec.version,
            "spec_json": json.loads(spec.spec_json),
            "user_id": spec.user_id,
            "created_at": spec.created_at,
            "updated_at": spec.updated_at,
        }
        result.append(spec_dict)

    return result


@router.get("/{spec_id}", response_model=OpenAPISpecResponse)
async def get_spec(
    spec_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific OpenAPI specification by ID"""
    spec = (
        db.query(OpenAPISpec)
        .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == current_user.id)
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


@router.post(
    "/", response_model=OpenAPISpecResponse, status_code=status.HTTP_201_CREATED
)
async def create_spec(
    spec_data: OpenAPISpecCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new OpenAPI specification"""
    spec_json = spec_data.spec_json

    # Validate the spec
    is_valid, errors, warnings = validate_openapi_spec(spec_json)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invalid OpenAPI specification",
                "errors": [{"field": e.field, "message": e.message} for e in errors],
                "warnings": warnings,
            },
        )

    # Check if name already exists for this user
    existing = (
        db.query(OpenAPISpec)
        .filter(
            OpenAPISpec.name == spec_data.name, OpenAPISpec.user_id == current_user.id
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Spec with name '{spec_data.name}' already exists",
        )

    # Extract title and version from spec_json
    title = spec_json.get("info", {}).get("title", "Untitled")
    version = spec_json.get("info", {}).get("version", "1.0.0")

    # Create new spec with user ownership
    new_spec = OpenAPISpec(
        name=spec_data.name,
        title=title,
        version=version,
        spec_json=json.dumps(spec_json),
        user_id=current_user.id,
    )

    db.add(new_spec)
    db.commit()
    db.refresh(new_spec)

    return {
        "id": new_spec.id,
        "name": new_spec.name,
        "title": new_spec.title,
        "version": new_spec.version,
        "spec_json": spec_json,
        "user_id": new_spec.user_id,
        "created_at": new_spec.created_at,
        "updated_at": new_spec.updated_at,
    }


@router.put("/{spec_id}", response_model=OpenAPISpecResponse)
async def update_spec(
    spec_id: int,
    spec_data: OpenAPISpecUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing OpenAPI specification.

    This endpoint requires the client to provide the base `version` they are
    updating from. The server validates that the provided version matches the
    latest published version (from SpecVersion) or the spec's current pointer.
    If validation fails a 409 Conflict is returned. On success, when updating
    spec_json a new SpecVersion entry is created for the new content.
    """
    spec = (
        db.query(OpenAPISpec)
        .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == current_user.id)
        .first()
    )

    if not spec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spec with id {spec_id} not found",
        )

    # Resolve latest published version from spec_versions table; fallback to spec.version
    latest_published = (
        db.query(SpecVersion)
        .filter(SpecVersion.spec_id == spec_id, SpecVersion.is_published == True)
        .order_by(SpecVersion.created_at.desc())
        .first()
    )
    expected_version = latest_published.version if latest_published else spec.version

    # Require version from client (OpenAPISpecUpdate now enforces this) and validate
    if spec_data.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Version conflict",
                "expected": expected_version,
                "provided": spec_data.version,
            },
        )

    # Validate if spec_json is being updated
    if spec_data.spec_json is not None:
        spec_json = spec_data.spec_json
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

        # Store current spec as previous version before updating
        spec.previous_spec_json = spec.spec_json

        # Update spec_json and extract title/version
        spec.spec_json = json.dumps(spec_json)
        spec.title = spec_json.get("info", {}).get("title", spec.title)
        new_version_str = spec_json.get("info", {}).get("version", spec.version)
        spec.version = new_version_str

        # Create a new SpecVersion entry for this update
        new_version = SpecVersion(
            spec_id=spec_id,
            version=new_version_str,
            content=spec_json,
            created_by=current_user.id,
        )
        try:
            db.add(new_version)
            db.flush()
            db.refresh(new_version)
        except IntegrityError as e:
            logger.warning("SpecVersion unique constraint violated on update: %s", e)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Version already exists for this spec",
            )
        except Exception as e:
            logger.exception("Error creating spec version during update: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
            )

    # Update name if provided
    if spec_data.name is not None:
        new_name = spec_data.name
        # Check if new name already exists for this user
        existing = (
            db.query(OpenAPISpec)
            .filter(
                OpenAPISpec.name == new_name,
                OpenAPISpec.id != spec_id,
                OpenAPISpec.user_id == current_user.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Spec with name '{new_name}' already exists",
            )
        spec.name = new_name

    db.commit()
    db.refresh(spec)

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


@router.delete("/{spec_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_spec(
    spec_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an OpenAPI specification"""
    spec = (
        db.query(OpenAPISpec)
        .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == current_user.id)
        .first()
    )

    if not spec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spec with id {spec_id} not found",
        )

    db.delete(spec)
    db.commit()

    return None


@router.post("/validate", response_model=ValidationResponse)
async def validate_spec(spec_json: dict):
    """Validate an OpenAPI specification without saving it"""
    if not isinstance(spec_json, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "valid": False,
                "errors": [
                    {"field": "root", "message": "Request must be a JSON object"}
                ],
                "warnings": [],
            },
        )

    is_valid, errors, warnings = validate_openapi_spec(spec_json)

    return {
        "valid": is_valid,
        "errors": [{"field": e.field, "message": e.message} for e in errors],
        "warnings": warnings,
    }


@router.get("/{spec_id}/diff")
async def get_spec_diff(
    spec_id: int,
    format: str = Query("json", regex="^(json|markdown)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the diff between current and previous version of a specification

    Query params:
    - format: 'json' (default) or 'markdown'
    """
    spec = (
        db.query(OpenAPISpec)
        .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == current_user.id)
        .first()
    )

    if not spec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spec with id {spec_id} not found",
        )

    if not spec.previous_spec_json:
        return {
            "has_changes": False,
            "message": "No previous version available for comparison",
        }

    current_spec = json.loads(spec.spec_json)
    previous_spec = json.loads(spec.previous_spec_json)

    diff = compare_specs(current_spec, previous_spec)

    if format == "markdown":
        markdown = generate_markdown_report(diff)
        return {"markdown": markdown}

    return diff


# --- Helpers for spec versions ---


def _resolve_spec_or_404(db: Session, spec_id: int, current_user: User) -> OpenAPISpec:
    spec = (
        db.query(OpenAPISpec)
        .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == current_user.id)
        .first()
    )
    if not spec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Spec not found"
        )
    return spec


def _serialize_version(version: SpecVersion) -> Dict[str, Any]:
    return {
        "id": version.id,
        "spec_id": version.spec_id,
        "version": version.version,
        "content": version.content,
        "created_by": version.created_by,
        "meta": version.meta,
        "created_at": version.created_at,
    }


def _resolve_version(
    db: Session, spec_id: int, version_or_id: str
) -> Optional[SpecVersion]:
    # Try UUID/id first
    try:
        val = str(uuid.UUID(version_or_id))
        ver = (
            db.query(SpecVersion)
            .filter(SpecVersion.id == val, SpecVersion.spec_id == spec_id)
            .first()
        )
        if ver:
            return ver
    except Exception:
        # not a UUID
        pass

    # Fallback to version string lookup
    ver = (
        db.query(SpecVersion)
        .filter(SpecVersion.spec_id == spec_id, SpecVersion.version == version_or_id)
        .first()
    )
    return ver


def _check_can_modify_version(
    current_user: User, spec: OpenAPISpec, version: SpecVersion
) -> bool:
    # Allow if user is spec owner or creator of version
    if current_user.id == spec.user_id:
        return True
    if version.created_by and current_user.id == version.created_by:
        return True
    # No admin role model available; deny otherwise
    return False


# --- Versioning endpoints ---
@router.get("/{spec_id}/versions", response_model=List[SpecVersionResponse])
async def list_versions(
    spec_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return list of versions for a spec ordered by created_at desc"""
    spec = _resolve_spec_or_404(db, spec_id, current_user)

    versions = (
        db.query(SpecVersion)
        .filter(SpecVersion.spec_id == spec_id)
        .order_by(SpecVersion.created_at.desc())
        .all()
    )

    return [_serialize_version(v) for v in versions]


@router.post(
    "/{spec_id}/versions",
    response_model=SpecVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_version(
    spec_id: int,
    payload: SpecVersionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new version for a spec"""
    spec = _resolve_spec_or_404(db, spec_id, current_user)

    # Validate basic payload
    if not payload.version or not isinstance(payload.content, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload"
        )

    new_version = SpecVersion(
        spec_id=spec_id,
        version=payload.version,
        content=payload.content,
        meta=payload.meta,
        created_by=current_user.id,
    )

    try:
        db.add(new_version)
        db.commit()
        db.refresh(new_version)
    except IntegrityError as e:
        logger.warning("SpecVersion unique constraint violated: %s", e)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Version already exists for this spec",
        )
    except Exception as e:
        logger.exception("Error creating spec version: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

    return _serialize_version(new_version)


@router.get("/{spec_id}/versions/{version_or_id}", response_model=SpecVersionResponse)
async def get_version(
    spec_id: int,
    version_or_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch a specific version by id or version string"""
    spec = _resolve_spec_or_404(db, spec_id, current_user)

    ver = _resolve_version(db, spec_id, version_or_id)
    if not ver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Spec version not found"
        )

    return _serialize_version(ver)


@router.delete(
    "/{spec_id}/versions/{version_or_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_version(
    spec_id: int,
    version_or_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a version. Only creator or spec owner may delete. Prevent deleting last published unless admin."""
    spec = _resolve_spec_or_404(db, spec_id, current_user)

    ver = _resolve_version(db, spec_id, version_or_id)
    if not ver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Spec version not found"
        )

    if not _check_can_modify_version(current_user, spec, ver):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to delete this version",
        )

    # If this is the last published version and spec has live pointer (spec.version == ver.version), disallow unless owner
    if (
        ver.is_published
        and spec.version == ver.version
        and current_user.id != spec.user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete published live version",
        )

    try:
        db.delete(ver)
    except Exception as e:
        logger.exception("Error deleting spec version: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

    return None


@router.post("/{spec_id}/compare")
async def compare_versions(
    spec_id: int,
    body: Dict[str, str],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compare two versions specified by id or version string"""
    spec = _resolve_spec_or_404(db, spec_id, current_user)

    base_key = body.get("base")
    compare_key = body.get("compare")
    if not base_key or not compare_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both 'base' and 'compare' are required",
        )

    base_ver = _resolve_version(db, spec_id, base_key)
    compare_ver = _resolve_version(db, spec_id, compare_key)

    if not base_ver or not compare_ver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both versions not found",
        )

    diff = compare_specs(base_ver.content, compare_ver.content)

    return {
        "base": _serialize_version(base_ver),
        "compare": _serialize_version(compare_ver),
        "diff": diff,
    }


@router.post(
    "/{spec_id}/versions/{version_or_id}/publish", response_model=SpecVersionResponse
)
async def publish_version(
    spec_id: int,
    version_or_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a version as published and set spec's current pointer to this version"""
    spec = _resolve_spec_or_404(db, spec_id, current_user)

    ver = _resolve_version(db, spec_id, version_or_id)
    if not ver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Spec version not found"
        )

    # Only spec owner (or creator if same) may publish. No admin model available.
    if current_user.id != spec.user_id and (
        not ver.created_by or current_user.id != ver.created_by
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to publish this version",
        )

    try:
        # mark all other versions is_published=False (simple approach)
        db.query(SpecVersion).filter(SpecVersion.spec_id == spec_id).update(
            {"is_published": False}
        )
        ver.is_published = True
        spec.version = ver.version
        db.add(ver)
        db.add(spec)
    except Exception as e:
        logger.exception("Error publishing spec version: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

    # refresh may not be available on simple sessions in tests; return serialized version
    return _serialize_version(ver)


@router.put("/{spec_id}/versions/{version_id}", response_model=SpecVersionResponse)
async def update_version(
    spec_id: int,
    version_id: str,
    payload: SpecVersionCreate = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing version for a spec."""
    spec = _resolve_spec_or_404(db, spec_id, current_user)
    ver = _resolve_version(db, spec_id, version_id)
    if not ver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Spec version not found"
        )
    if not _check_can_modify_version(current_user, spec, ver):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to edit this version",
        )
    # Validate payload
    if not payload.version or not isinstance(payload.content, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload"
        )
    # Update fields
    ver.version = payload.version
    ver.content = payload.content
    if payload.meta is not None:
        ver.meta = payload.meta
    db.add(ver)
    db.commit()
    db.refresh(ver)
    return _serialize_version(ver)
