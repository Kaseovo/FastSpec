"""
Lint endpoints – run Stoplight Spectral against stored or ad-hoc OpenAPI specs.

This router is intentionally thin: it handles HTTP concerns only.
- Spec ownership checks are delegated to SpecService.get_spec().
- Lint orchestration is delegated to LintService.
- Ruleset CRUD is delegated to LintRulesetRepository.
- SpectralError → HTTP 502 conversion lives here (and only here).
"""

import logging

import yaml
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database import get_db
from models import User
from schemas import (
    LintRequest,
    LintResponse,
    LintRulesetResponse,
    LintRulesetUpsertRequest,
    StructuredRule,
)
from services.lint_ruleset_repository import LintRulesetRepository
from services.lint_service import LintService
from services.spec_service import SpecService
from validation.spectral_client import SpectralClient, SpectralError, get_spectral_client

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lint endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/{spec_id}",
    response_model=LintResponse,
    summary="Lint a stored OpenAPI specification",
    description=(
        "Runs Stoplight Spectral against the OpenAPI spec identified by `spec_id`. "
        "The spec must belong to the authenticated user. The user's custom ruleset "
        "(if configured) is applied automatically."
    ),
)
async def lint_spec_by_id(
    spec_id: str,
    version: str = Query(
        ...,
        description="Version of the spec to lint (required)",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    spectral_client: SpectralClient = Depends(get_spectral_client),
) -> LintResponse:
    # Ownership check via SpecService (raises 404 if absent or not owned)
    spec_service = SpecService(db)
    spec_service.get_spec(current_user, spec_id)

    # Resolve the specific version
    from models import SpecVersion

    spec_version = (
        db.query(SpecVersion)
        .filter(SpecVersion.spec_id == spec_id, SpecVersion.version == version)
        .first()
    )
    if not spec_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version} for spec {spec_id} not found",
        )

    try:
        return LintService(db, spectral_client).lint(spec_version.content, current_user.id)
    except SpectralError as exc:
        logger.error("Spectral lint failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Linting failed: {exc}",
        ) from exc


@router.post(
    "",
    response_model=LintResponse,
    summary="Lint an ad-hoc OpenAPI specification",
    description=(
        "Runs Stoplight Spectral against the raw spec JSON provided in the request body. "
        "No spec is saved; this is useful for live editor validation. "
        "The user's custom ruleset (if configured) is applied automatically."
    ),
)
async def lint_spec_adhoc(
    body: LintRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    spectral_client: SpectralClient = Depends(get_spectral_client),
) -> LintResponse:
    try:
        return LintService(db, spectral_client).lint(body.spec_json, current_user.id)
    except SpectralError as exc:
        logger.error("Spectral lint failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Linting failed: {exc}",
        ) from exc


@router.post(
    "/{spec_id}/lint-draft",
    response_model=LintResponse,
    summary="Lint an unsaved draft for an existing spec",
    description=(
        "Runs Stoplight Spectral against a draft OpenAPI spec provided in the request body. "
        "The `spec_id` is used only to confirm the user has access to the spec; the draft is not stored. "
        "The user's custom ruleset (if configured) is applied automatically."
    ),
)
async def lint_draft(
    spec_id: str,
    body: LintRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    spectral_client: SpectralClient = Depends(get_spectral_client),
) -> LintResponse:
    # Ownership check via SpecService (raises 404 if absent or not owned)
    spec_service = SpecService(db)
    spec_service.get_spec(current_user, spec_id)

    if not isinstance(body.spec_json, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="spec_json must be a JSON object",
        )

    try:
        return LintService(db, spectral_client).lint(body.spec_json, current_user.id)
    except SpectralError as exc:
        logger.error("Spectral lint failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Linting failed: {exc}",
        ) from exc


# ---------------------------------------------------------------------------
# Ruleset management endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/ruleset",
    response_model=LintRulesetResponse,
    summary="Get the current user's custom lint ruleset",
    description="Returns the authenticated user's custom Spectral ruleset, or 404 if none is configured.",
)
async def get_lint_ruleset(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LintRulesetResponse:
    row = LintRulesetRepository(db).get(current_user.id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No custom ruleset configured for this user.",
        )
    return LintRulesetResponse(
        rules=[StructuredRule(**r) for r in row.rules_json] if row.rules_json else None,
        raw_yaml=row.raw_yaml,
        updated_at=row.updated_at,
    )


@router.put(
    "/ruleset",
    response_model=LintRulesetResponse,
    summary="Create or replace the current user's custom lint ruleset",
    description=(
        "Upserts the authenticated user's global Spectral ruleset. "
        "If `raw_yaml` is provided it must be valid YAML syntax — a 400 is returned otherwise. "
        "When `raw_yaml` is present it takes precedence over `rules` at lint time."
    ),
)
async def upsert_lint_ruleset(
    body: LintRulesetUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LintRulesetResponse:
    # YAML syntax validation is an input concern — stays in the router
    if body.raw_yaml is not None:
        try:
            yaml.safe_load(body.raw_yaml)
        except yaml.YAMLError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid YAML in raw_yaml: {exc}",
            ) from exc

    rules_json = (
        [r.model_dump() for r in body.rules] if body.rules is not None else None
    )

    row = LintRulesetRepository(db).upsert(current_user.id, rules_json, body.raw_yaml)
    return LintRulesetResponse(
        rules=[StructuredRule(**r) for r in row.rules_json] if row.rules_json else None,
        raw_yaml=row.raw_yaml,
        updated_at=row.updated_at,
    )


@router.delete(
    "/ruleset",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete the current user's custom lint ruleset",
    description=(
        "Removes the authenticated user's custom Spectral ruleset. "
        "Subsequent lint runs will fall back to the default `spectral:oas` ruleset."
    ),
)
async def delete_lint_ruleset(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    LintRulesetRepository(db).delete(current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
