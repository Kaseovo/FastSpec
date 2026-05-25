"""
Lint endpoints – run Stoplight Spectral against stored or ad-hoc OpenAPI specs.
"""

import logging
import uuid

import yaml
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database import get_db
from models import OpenAPISpec, SpecVersion, User, UserLintRuleset
from schemas import (
    LintRequest,
    LintResponse,
    LintRulesetResponse,
    LintRulesetUpsertRequest,
    LintSummary,
    StructuredRule,
)
from validation.spectral_linter import run_spectral

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fetch_user_ruleset(user_id: int, db: Session) -> dict | None:
    """Return the user's lint ruleset as a plain dict, or None if not set."""
    row = db.query(UserLintRuleset).filter(UserLintRuleset.user_id == user_id).first()
    if row is None:
        return None
    return {"rules_json": row.rules_json, "raw_yaml": row.raw_yaml}


def _do_lint(spec_json: dict, user_ruleset: dict | None) -> LintResponse:
    """Shared helper: run Spectral and coerce result into LintResponse."""
    try:
        raw = run_spectral(spec_json, user_ruleset=user_ruleset)
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
        .filter(SpecVersion.spec_id == spec_id, SpecVersion.version == version)
        .first()
    )
    if not spec_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version} for spec {spec_id} not found",
        )

    user_ruleset = _fetch_user_ruleset(current_user.id, db)
    return _do_lint(spec_version.content, user_ruleset)


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
) -> LintResponse:
    user_ruleset = _fetch_user_ruleset(current_user.id, db)
    return _do_lint(body.spec_json, user_ruleset)


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

    if not isinstance(body.spec_json, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="spec_json must be a JSON object",
        )

    user_ruleset = _fetch_user_ruleset(current_user.id, db)
    return _do_lint(body.spec_json, user_ruleset)


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
    row = (
        db.query(UserLintRuleset)
        .filter(UserLintRuleset.user_id == current_user.id)
        .first()
    )
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
    # Validate raw_yaml syntax at save time
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

    row = (
        db.query(UserLintRuleset)
        .filter(UserLintRuleset.user_id == current_user.id)
        .first()
    )
    if row is None:
        row = UserLintRuleset(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            rules_json=rules_json,
            raw_yaml=body.raw_yaml,
        )
        db.add(row)
    else:
        row.rules_json = rules_json
        row.raw_yaml = body.raw_yaml

    db.commit()
    db.refresh(row)

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
    row = (
        db.query(UserLintRuleset)
        .filter(UserLintRuleset.user_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No custom ruleset configured for this user.",
        )
    db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
