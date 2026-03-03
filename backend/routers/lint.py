"""
Lint endpoints – run Stoplight Spectral against stored or ad-hoc OpenAPI specs.
"""

import json
import logging
from typing import Optional
from uuid import UUID
from models import SpecVersion

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database import get_db
from models import OpenAPISpec, User
from schemas import LintRequest, LintResponse, LintSummary
from validation.spectral_linter import run_spectral

router = APIRouter()
logger = logging.getLogger(__name__)


def _do_lint(spec_json: dict, ruleset: str) -> LintResponse:
    """Shared helper: run Spectral and coerce result into LintResponse."""
    try:
        raw = run_spectral(spec_json, ruleset=ruleset)
    except RuntimeError as exc:
        logger.error("Spectral lint failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Linting failed: {exc}",
        ) from exc

    return LintResponse(
        score=raw["score"],
        summary=LintSummary(**raw["summary"]),
        results=raw["results"],
    )


@router.post(
    "/{spec_id}",
    response_model=LintResponse,
    summary="Lint a stored OpenAPI specification",
    description=(
        "Runs Stoplight Spectral against the OpenAPI spec identified by `spec_id`. "
        "The spec must belong to the authenticated user."
    ),
)
async def lint_spec_by_id(
    spec_id: str,
    version: str = Query(
        ...,  # required
        description="Version of the spec to lint (required)",
    ),
    ruleset: str = Query(
        default="spectral:oas",
        description="Spectral ruleset identifier or URL",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LintResponse:
    spec = (
        db.query(OpenAPISpec)
        .filter(OpenAPISpec.id == str(spec_id), OpenAPISpec.user_id == current_user.id)
        .first()
    )
    if not spec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spec with id {spec_id} not found",
        )

    spec_version = (
        db.query(SpecVersion)
        .filter(SpecVersion.spec_id == spec.id, SpecVersion.version == version)
        .first()
    )
    if not spec_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version} for spec {spec_id} not found",
        )

    spec_json = spec_version.content
    return _do_lint(spec_json, ruleset)


@router.post(
    "",
    response_model=LintResponse,
    summary="Lint an ad-hoc OpenAPI specification",
    description=(
        "Runs Stoplight Spectral against the raw spec JSON provided in the request body. "
        "No spec is saved; this is useful for live editor validation."
    ),
)
async def lint_spec_adhoc(
    body: LintRequest,
    current_user: User = Depends(get_current_user),  # require auth even for ad-hoc
) -> LintResponse:
    ruleset = body.ruleset or "spectral:oas"
    return _do_lint(body.spec_json, ruleset)
