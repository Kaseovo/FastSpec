"""
API routes for OpenAPI specifications
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
import json

from ..database import get_db
from ..models import OpenAPISpec
from ..schemas import (
    OpenAPISpecCreate,
    OpenAPISpecUpdate,
    OpenAPISpecResponse,
    ValidationResponse,
    DiffResponse,
    MarkdownDiffResponse,
    ValidationError as ValidationErrorSchema,
)
from validator import validate_openapi_spec
from diff_utils import compare_specs, generate_markdown_report


router = APIRouter()


@router.get("/specs", response_model=List[OpenAPISpecResponse])
async def list_specs(db: Session = Depends(get_db)):
    """List all OpenAPI specifications"""
    specs = db.query(OpenAPISpec).order_by(OpenAPISpec.created_at.desc()).all()

    # Convert spec_json from string to dict
    result = []
    for spec in specs:
        spec_dict = {
            "id": spec.id,
            "name": spec.name,
            "title": spec.title,
            "version": spec.version,
            "spec_json": json.loads(spec.spec_json),
            "created_at": spec.created_at,
            "updated_at": spec.updated_at,
        }
        result.append(spec_dict)

    return result


@router.get("/specs/{spec_id}", response_model=OpenAPISpecResponse)
async def get_spec(spec_id: int, db: Session = Depends(get_db)):
    """Get a specific OpenAPI specification by ID"""
    spec = db.query(OpenAPISpec).filter(OpenAPISpec.id == spec_id).first()

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
        "created_at": spec.created_at,
        "updated_at": spec.updated_at,
    }


@router.post(
    "/specs", response_model=OpenAPISpecResponse, status_code=status.HTTP_201_CREATED
)
async def create_spec(spec_data: OpenAPISpecCreate, db: Session = Depends(get_db)):
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

    # Check if name already exists
    existing = db.query(OpenAPISpec).filter(OpenAPISpec.name == spec_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Spec with name '{spec_data.name}' already exists",
        )

    # Extract title and version from spec_json
    title = spec_json.get("info", {}).get("title", "Untitled")
    version = spec_json.get("info", {}).get("version", "1.0.0")

    # Create new spec
    new_spec = OpenAPISpec(
        name=spec_data.name,
        title=title,
        version=version,
        spec_json=json.dumps(spec_json),
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
        "created_at": new_spec.created_at,
        "updated_at": new_spec.updated_at,
    }


@router.put("/specs/{spec_id}", response_model=OpenAPISpecResponse)
async def update_spec(
    spec_id: int, spec_data: OpenAPISpecUpdate, db: Session = Depends(get_db)
):
    """Update an existing OpenAPI specification"""
    spec = db.query(OpenAPISpec).filter(OpenAPISpec.id == spec_id).first()

    if not spec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spec with id {spec_id} not found",
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
        spec.version = spec_json.get("info", {}).get("version", spec.version)

    # Update name if provided
    if spec_data.name is not None:
        new_name = spec_data.name
        # Check if new name already exists
        existing = (
            db.query(OpenAPISpec)
            .filter(OpenAPISpec.name == new_name, OpenAPISpec.id != spec_id)
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
        "created_at": spec.created_at,
        "updated_at": spec.updated_at,
    }


@router.delete("/specs/{spec_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_spec(spec_id: int, db: Session = Depends(get_db)):
    """Delete an OpenAPI specification"""
    spec = db.query(OpenAPISpec).filter(OpenAPISpec.id == spec_id).first()

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


@router.get("/specs/{spec_id}/diff")
async def get_spec_diff(
    spec_id: int,
    format: str = Query("json", regex="^(json|markdown)$"),
    db: Session = Depends(get_db),
):
    """
    Get the diff between current and previous version of a specification

    Query params:
    - format: 'json' (default) or 'markdown'
    """
    spec = db.query(OpenAPISpec).filter(OpenAPISpec.id == spec_id).first()

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
