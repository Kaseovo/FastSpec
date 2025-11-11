from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import json

from database import get_db, init_db, OpenAPISpec
from schemas import (
    OpenAPISpecCreate,
    OpenAPISpecUpdate,
    OpenAPISpecResponse,
    ValidationResponse,
    ValidationError as ValidationErrorSchema,
)
from validator import validate_openapi_spec
from diff_utils import compare_specs, generate_markdown_report

app = FastAPI(
    title="FastSpec API",
    description="API for managing OpenAPI specifications",
    version="1.0.1",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://0.0.0.0:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/")
def root():
    return {
        "message": "FastSpec API",
        "version": "1.0.0",
        "endpoints": {"specs": "/api/specs", "docs": "/docs"},
    }


@app.get("/api/specs", response_model=List[OpenAPISpecResponse])
def list_specs(db: Session = Depends(get_db)):
    """List all OpenAPI specifications"""
    specs = db.query(OpenAPISpec).all()
    return [
        OpenAPISpecResponse(
            id=spec.id,
            name=spec.name,
            title=spec.title,
            version=spec.version,
            spec_json=json.loads(spec.spec_json),
            created_at=spec.created_at,
            updated_at=spec.updated_at,
        )
        for spec in specs
    ]


@app.get("/api/specs/{spec_id}", response_model=OpenAPISpecResponse)
def get_spec(spec_id: int, db: Session = Depends(get_db)):
    """Get a specific OpenAPI specification by ID"""
    spec = db.query(OpenAPISpec).filter(OpenAPISpec.id == spec_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Spec not found")

    return OpenAPISpecResponse(
        id=spec.id,
        name=spec.name,
        title=spec.title,
        version=spec.version,
        spec_json=json.loads(spec.spec_json),
        created_at=spec.created_at,
        updated_at=spec.updated_at,
    )


@app.post(
    "/api/specs",
    response_model=OpenAPISpecResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_spec(spec: OpenAPISpecCreate, db: Session = Depends(get_db)):
    """Create a new OpenAPI specification"""

    # Validate the spec
    is_valid, errors, warnings = validate_openapi_spec(spec.spec_json)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid OpenAPI specification",
                "errors": [{"field": e.field, "message": e.message} for e in errors],
                "warnings": warnings,
            },
        )

    # Check if name already exists
    existing = db.query(OpenAPISpec).filter(OpenAPISpec.name == spec.name).first()
    if existing:
        raise HTTPException(
            status_code=400, detail=f"Spec with name '{spec.name}' already exists"
        )

    # Extract title and version from spec_json
    title = spec.spec_json.get("info", {}).get("title", "Untitled")
    version = spec.spec_json.get("info", {}).get("version", "1.0.0")

    # Create new spec
    db_spec = OpenAPISpec(
        name=spec.name,
        title=title,
        version=version,
        spec_json=json.dumps(spec.spec_json),
    )
    db.add(db_spec)
    db.commit()
    db.refresh(db_spec)

    return OpenAPISpecResponse(
        id=db_spec.id,
        name=db_spec.name,
        title=db_spec.title,
        version=db_spec.version,
        spec_json=json.loads(db_spec.spec_json),
        created_at=db_spec.created_at,
        updated_at=db_spec.updated_at,
    )


@app.put("/api/specs/{spec_id}", response_model=OpenAPISpecResponse)
def update_spec(
    spec_id: int, spec_update: OpenAPISpecUpdate, db: Session = Depends(get_db)
):
    """Update an existing OpenAPI specification"""

    db_spec = db.query(OpenAPISpec).filter(OpenAPISpec.id == spec_id).first()
    if not db_spec:
        raise HTTPException(status_code=404, detail="Spec not found")

    # Validate if spec_json is being updated
    if spec_update.spec_json is not None:
        is_valid, errors, warnings = validate_openapi_spec(spec_update.spec_json)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid OpenAPI specification",
                    "errors": [
                        {"field": e.field, "message": e.message} for e in errors
                    ],
                    "warnings": warnings,
                },
            )

        # Store current spec as previous version before updating
        db_spec.previous_spec_json = db_spec.spec_json

        # Update spec_json and extract title/version
        db_spec.spec_json = json.dumps(spec_update.spec_json)
        db_spec.title = spec_update.spec_json.get("info", {}).get(
            "title", db_spec.title
        )
        db_spec.version = spec_update.spec_json.get("info", {}).get(
            "version", db_spec.version
        )

    # Update name if provided
    if spec_update.name is not None:
        # Check if new name already exists
        existing = (
            db.query(OpenAPISpec)
            .filter(OpenAPISpec.name == spec_update.name, OpenAPISpec.id != spec_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Spec with name '{spec_update.name}' already exists",
            )
        db_spec.name = spec_update.name

    db.commit()
    db.refresh(db_spec)

    return OpenAPISpecResponse(
        id=db_spec.id,
        name=db_spec.name,
        title=db_spec.title,
        version=db_spec.version,
        spec_json=json.loads(db_spec.spec_json),
        created_at=db_spec.created_at,
        updated_at=db_spec.updated_at,
    )


@app.delete("/api/specs/{spec_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_spec(spec_id: int, db: Session = Depends(get_db)):
    """Delete an OpenAPI specification"""

    db_spec = db.query(OpenAPISpec).filter(OpenAPISpec.id == spec_id).first()
    if not db_spec:
        raise HTTPException(status_code=404, detail="Spec not found")

    db.delete(db_spec)
    db.commit()

    return None


@app.post("/api/validate", response_model=ValidationResponse)
def validate_spec(spec_json: dict):
    """Validate an OpenAPI specification without saving it"""

    is_valid, errors, warnings = validate_openapi_spec(spec_json)

    return ValidationResponse(
        valid=is_valid,
        errors=[
            ValidationErrorSchema(field=e.field, message=e.message) for e in errors
        ],
        warnings=warnings,
    )


@app.get("/api/specs/{spec_id}/diff")
def get_spec_diff(spec_id: int, format: str = "json", db: Session = Depends(get_db)):
    """
    Get the diff between current and previous version of a specification

    Query params:
    - format: 'json' (default) or 'markdown'
    """
    spec = db.query(OpenAPISpec).filter(OpenAPISpec.id == spec_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Spec not found")

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
