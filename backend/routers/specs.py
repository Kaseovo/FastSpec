"""
API routes for OpenAPI specifications
"""

import logging
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database import get_db
from models import User
from schemas import (
    OpenAPISpecCreate,
    OpenAPISpecResponse,
    OpenAPISpecUpdate,
    SpecCompareResponse,
    SpecDiffResponse,
    SpecVersionCreate,
    SpecVersionResponse,
    ValidationResponse,
)
from services.spec_service import SpecService
from services.spec_version_service import SpecVersionService
from validation.diff_utils import compare_specs, generate_markdown_report
from validation.validator import validate_openapi_spec


def get_version_service(db: Session = Depends(get_db)) -> SpecVersionService:
    return SpecVersionService(db)


router = APIRouter()
logger = logging.getLogger(__name__)


# --- existing endpoints (unchanged) ---
@router.get("", response_model=list[OpenAPISpecResponse])
def list_specs(
    skip: int = Query(0, ge=0, description="Number of specs to skip"),
    limit: int | None = Query(
        None, ge=1, le=200, description="Max number of specs to return"
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all OpenAPI specifications for the current user"""
    service = SpecService(db)
    return service.list_specs(current_user, skip=skip, limit=limit)


@router.get("/{spec_id}", response_model=OpenAPISpecResponse)
def get_spec(
    spec_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific OpenAPI specification by ID"""
    service = SpecService(db)
    return service.get_spec(current_user, spec_id)


@router.post(
    "", response_model=OpenAPISpecResponse, status_code=status.HTTP_201_CREATED
)
def create_spec(
    spec_data: OpenAPISpecCreate,
    version: str | None = Query(
        None,
        description="Deprecated: pass `version` in the request body instead.",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new OpenAPI specification and its initial version"""
    service = SpecService(db)
    return service.create_spec(current_user, spec_data, version)


@router.put("/{spec_id}", response_model=OpenAPISpecResponse)
def update_spec(
    spec_id: str,
    spec_data: OpenAPISpecUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update only the name of an existing OpenAPI specification."""
    service = SpecService(db)
    return service.update_spec(current_user, spec_id, spec_data)


@router.delete("/{spec_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_spec(
    spec_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an OpenAPI specification"""
    service = SpecService(db)
    return service.delete_spec(current_user, spec_id)


@router.post("/validate", response_model=ValidationResponse)
def validate_spec(spec_json: dict):
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


@router.get("/{spec_id}/diff", response_model=SpecDiffResponse)
def get_spec_diff(
    spec_id: str,
    output_format: str = Query("json", pattern="^(json|markdown)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the diff between current and previous version of a specification

    Query params:
    - output_format: 'json' (default) or 'markdown'
    """
    svc = SpecVersionService(db)
    svc.owned_spec_or_404(current_user, spec_id)

    recent_versions = svc.list_versions(current_user, spec_id)[:2]

    if len(recent_versions) < 2:
        return {
            "has_changes": False,
            "message": "No previous version available for comparison",
        }

    current_content = recent_versions[0].content
    previous_content = recent_versions[1].content
    diff = compare_specs(current_content, previous_content)

    if output_format == "markdown":
        return {"markdown": generate_markdown_report(diff)}

    return {"diff": diff}


# --- Versioning endpoints ---
@router.get("/{spec_id}/versions", response_model=list[SpecVersionResponse])
def list_versions(
    spec_id: str,
    current_user: User = Depends(get_current_user),
    svc: SpecVersionService = Depends(get_version_service),
):
    """Return list of versions for a spec ordered by created_at desc"""
    return svc.list_versions(current_user, spec_id)


@router.post(
    "/{spec_id}/versions",
    response_model=SpecVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_version(
    spec_id: str,
    payload: SpecVersionCreate,
    current_user: User = Depends(get_current_user),
    svc: SpecVersionService = Depends(get_version_service),
):
    """Create a new version for a spec"""
    return svc.create_version(
        current_user, spec_id, payload.version, payload.content, payload.meta
    )


@router.get("/{spec_id}/versions/{version_id}", response_model=SpecVersionResponse)
def get_version(
    spec_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    svc: SpecVersionService = Depends(get_version_service),
):
    """Fetch a specific version by version string or id"""
    return svc.get_version(current_user, spec_id, version_id)


@router.delete(
    "/{spec_id}/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_version(
    spec_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    svc: SpecVersionService = Depends(get_version_service),
):
    """Delete a version by version string or id."""
    svc.delete_version(current_user, spec_id, version_id)
    return None


@router.post("/{spec_id}/compare", response_model=SpecCompareResponse)
def compare_versions(
    spec_id: str,
    body: dict[str, Any],
    current_user: User = Depends(get_current_user),
    svc: SpecVersionService = Depends(get_version_service),
):
    """Compare a stored base against either another stored version or an unsaved draft provided inline."""
    base_key = body.get("base")
    compare_key = body.get("compare")
    compare_content = body.get("compare_content")
    options = body.get("options", {}) or {}

    if not base_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'base' is required",
        )

    base_ver = svc.resolve_base_version(current_user, spec_id, base_key)

    if compare_content is not None:
        if not isinstance(compare_content, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="compare_content must be a JSON object",
            )
        # compare_specs(current, previous): the base is the "before" side.
        diff = compare_specs(compare_content, base_ver.content)
        compare_ver = None
    else:
        if not compare_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either 'compare' or 'compare_content' is required",
            )
        compare_ver = svc.get_version(current_user, spec_id, compare_key)
        diff = compare_specs(compare_ver.content, base_ver.content)

    # Always compute the markdown rendering alongside the structured diff so
    # callers that only need the human-readable report (e.g. a "copy as
    # markdown" action) don't have to duplicate the formatting logic
    # client-side. `options.format == "markdown"` is kept for backward
    # compatibility and returns a markdown-only payload.
    markdown = generate_markdown_report(diff)
    fmt = options.get("format", "structured")
    if fmt == "markdown":
        return {
            "base": base_ver,
            "compare": compare_ver,
            "markdown": markdown,
        }

    # Default: structured JSON diff, with markdown included for convenience.
    return {
        "base": base_ver,
        "compare": compare_ver,
        "diff": diff,
        "markdown": markdown,
    }


@router.post(
    "/{spec_id}/versions/{version_id}/publish", response_model=SpecVersionResponse
)
def publish_version(
    spec_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    svc: SpecVersionService = Depends(get_version_service),
):
    """Mark a version as published and set spec's current pointer to this version"""
    return svc.publish(current_user, spec_id, version_id)


@router.put("/{spec_id}/versions/{version_id}", response_model=SpecVersionResponse)
def update_version(
    spec_id: str,
    version_id: str,
    payload: SpecVersionCreate = Body(...),
    current_user: User = Depends(get_current_user),
    svc: SpecVersionService = Depends(get_version_service),
):
    """Update an existing version for a spec."""
    return svc.update_version(
        current_user, spec_id, version_id, payload.version, payload.content, payload.meta
    )
