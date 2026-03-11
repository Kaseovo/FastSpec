"""
API routes for OpenAPI specifications
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Dict, Any, Optional
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
from services.spec_service import SpecService


router = APIRouter()
logger = logging.getLogger(__name__)


# --- existing endpoints (unchanged) ---
@router.get("/", response_model=List[OpenAPISpecResponse])
async def list_specs(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """List all OpenAPI specifications for the current user"""
    service = SpecService(db)
    return service.list_specs(current_user)


@router.get("/{spec_id}", response_model=OpenAPISpecResponse)
async def get_spec(
    spec_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific OpenAPI specification by ID"""
    service = SpecService(db)
    return service.get_spec(current_user, spec_id)


@router.post(
    "/", response_model=OpenAPISpecResponse, status_code=status.HTTP_201_CREATED
)
async def create_spec(
    spec_data: OpenAPISpecCreate,
    version: str = Query(..., description="Version for the spec"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new OpenAPI specification and its initial version"""
    service = SpecService(db)
    return service.create_spec(current_user, spec_data, version)


@router.put("/{spec_id}", response_model=OpenAPISpecResponse)
async def update_spec(
    spec_id: str,
    spec_data: OpenAPISpecUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update only the name of an existing OpenAPI specification."""
    service = SpecService(db)
    return service.update_spec(current_user, spec_id, spec_data)


@router.delete("/{spec_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_spec(
    spec_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an OpenAPI specification"""
    service = SpecService(db)
    return service.delete_spec(current_user, spec_id)


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
    spec_id: str,
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

    diff = compare_specs(spec.spec_json, spec.previous_spec_json)

    if format == "markdown":
        markdown = generate_markdown_report(diff)
        return {"markdown": markdown}

    return diff


# --- Helpers for spec versions ---


def _resolve_spec_or_404(db: Session, spec_id: str, current_user: User) -> OpenAPISpec:
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
    # Deprecated helper kept for compatibility in places that still need dicts.
    # Prefer returning ORM objects directly and relying on Pydantic response_model.
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
    db: Session, spec_id: str, version_or_id: str
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
    spec_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return list of versions for a spec ordered by created_at desc"""
    # Ensure spec exists and user has access; we don't need the returned object here
    _resolve_spec_or_404(db, spec_id, current_user)

    versions = (
        db.query(SpecVersion)
        .filter(SpecVersion.spec_id == spec_id)
        .order_by(SpecVersion.created_at.desc())
        .all()
    )
    return versions


@router.post(
    "/{spec_id}/versions",
    response_model=SpecVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_version(
    spec_id: str,
    payload: SpecVersionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new version for a spec"""
    _resolve_spec_or_404(db, spec_id, current_user)

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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Version already exists for this spec",
        )
    except Exception as e:
        logger.exception("Error creating spec version: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

    return new_version


@router.get("/{spec_id}/versions/{version_id}", response_model=SpecVersionResponse)
async def get_version(
    spec_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch a specific version by version string only"""
    _resolve_spec_or_404(db, spec_id, current_user)
    # Accept both version string and UUID for compatibility
    from uuid import UUID

    try:
        # Try to interpret version_id as UUID
        uuid_obj = UUID(version_id)
        ver = (
            db.query(SpecVersion)
            .filter(SpecVersion.id == str(uuid_obj), SpecVersion.spec_id == spec_id)
            .first()
        )
    except ValueError:
        # Fallback to version string
        ver = (
            db.query(SpecVersion)
            .filter(SpecVersion.spec_id == spec_id, SpecVersion.version == version_id)
            .first()
        )
    if not ver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Spec version not found"
        )
    return ver


@router.delete(
    "/{spec_id}/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_version(
    spec_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a version by version string only."""
    spec = _resolve_spec_or_404(db, spec_id, current_user)
    ver = (
        db.query(SpecVersion)
        .filter(SpecVersion.spec_id == spec_id, SpecVersion.version == version_id)
        .first()
    )
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
    spec_id: str,
    body: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compare a stored base against either another stored version or an unsaved draft provided inline."""
    _resolve_spec_or_404(db, spec_id, current_user)

    base_key = body.get("base")
    compare_key = body.get("compare")
    compare_content = body.get("compare_content")
    options = body.get("options", {}) or {}

    if not base_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'base' is required",
        )

    # Resolve base version: support special tokens 'live' or 'latest'
    base_ver = None
    if base_key in ("live", "latest"):
        base_ver = (
            db.query(SpecVersion)
            .filter(SpecVersion.spec_id == spec_id, SpecVersion.is_published)
            .order_by(SpecVersion.created_at.desc())
            .first()
        )
    else:
        base_ver = _resolve_version(db, spec_id, base_key)

    if not base_ver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Base version not found",
        )

    # If inline compare_content provided, compare against draft
    if compare_content is not None:
        if not isinstance(compare_content, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="compare_content must be a JSON object",
            )
        diff = compare_specs(base_ver.content, compare_content)
        compare_serialized = {"id": None, "is_draft": True}
    else:
        # Compare two stored versions; require compare key
        if not compare_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either 'compare' or 'compare_content' is required",
            )
        compare_ver = _resolve_version(db, spec_id, compare_key)
        if not compare_ver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compare version not found",
            )
        diff = compare_specs(base_ver.content, compare_ver.content)

    # Format handling
    fmt = options.get("format", "structured")
    if fmt == "markdown":
        markdown = generate_markdown_report(diff)
        return {
            "base": base_ver,
            "compare": compare_ver,
            "markdown": markdown,
        }

    # Default: structured JSON diff
    return {
        "base": base_ver,
        "compare": compare_ver,
        "diff": diff,
    }


@router.post(
    "/{spec_id}/versions/{version_id}/publish", response_model=SpecVersionResponse
)
async def publish_version(
    spec_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a version as published and set spec's current pointer to this version"""
    spec = _resolve_spec_or_404(db, spec_id, current_user)
    ver = (
        db.query(SpecVersion)
        .filter(SpecVersion.spec_id == spec_id, SpecVersion.version == version_id)
        .first()
    )
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
    # refresh may not be available on simple sessions in tests; return version ORM object
    return ver


@router.put("/{spec_id}/versions/{version_id}", response_model=SpecVersionResponse)
async def update_version(
    spec_id: str,
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
    return ver
