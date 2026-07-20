"""
Lint endpoints – run Stoplight Spectral against stored or ad-hoc OpenAPI specs.

This router is intentionally thin: it handles HTTP concerns only.
- Spec ownership checks are delegated to SpecService.get_spec().
- Lint orchestration and ruleset resolution are delegated to LintService.
- Ruleset CRUD is delegated to LintRulesetRepository.
- SpectralError → HTTP 502 conversion is a single FastAPI exception handler
  registered in main.py; endpoints let it propagate rather than each
  catching and converting it individually.
"""

import yaml
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database import get_db
from models import LintRuleset, OpenAPISpec, User
from schemas import (
    LintPreviewRuleRequest,
    LintRequest,
    LintResponse,
    LintRulesetResponse,
    LintRulesetSummary,
    LintRulesetUpsertRequest,
    SpecRulesetAssignRequest,
    StructuredRule,
)
from services.lint_ruleset_repository import LintRulesetRepository
from services.lint_service import LintService
from services.spec_service import SpecService
from validation.spectral_client import SpectralClient, spectral_client_dependency
from validation.spectral_linter import RulesetSecurityError, validate_ruleset_yaml_is_safe

router = APIRouter()


def _to_response(row: LintRuleset) -> LintRulesetResponse:
    return LintRulesetResponse(
        id=row.id,
        name=row.name,
        is_default=row.is_default,
        rules=[StructuredRule(**r) for r in row.rules_json] if row.rules_json else None,
        raw_yaml=row.raw_yaml,
        updated_at=row.updated_at,
    )


def _to_summary(row: LintRuleset) -> LintRulesetSummary:
    return LintRulesetSummary(
        id=row.id,
        name=row.name,
        is_default=row.is_default,
        rule_count=len(row.rules_json) if row.rules_json else 0,
        has_raw_yaml=bool(row.raw_yaml),
        updated_at=row.updated_at,
    )


def _validate_raw_yaml(raw_yaml: str | None) -> None:
    """YAML syntax + security validation are input concerns — stay in the router.

    raw_yaml is written straight to a file the Spectral CLI executes
    against, so `functions`/`functionsDir` (arbitrary JS from disk) and
    `extends` pointing at a URL (SSRF) must be rejected before it's stored.
    """
    if raw_yaml is None:
        return
    try:
        yaml.safe_load(raw_yaml)
    except yaml.YAMLError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid YAML in raw_yaml: {exc}",
        ) from exc
    try:
        validate_ruleset_yaml_is_safe(raw_yaml)
    except RulesetSecurityError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# ---------------------------------------------------------------------------
# Lint endpoints
#
# NOTE ON ORDERING: `/{spec_id}` and `/{spec_id}/lint-draft` are catch-all
# path-param routes registered *after* every static-path route below
# ("", "/preview-rule", "/rulesets*", "/spec/{spec_id}/ruleset"). FastAPI/
# Starlette matches routes in registration order, so a static POST route
# registered after `/{spec_id}` would never be reached — a request to
# POST /rulesets would instead match `/{spec_id}` with spec_id="rulesets".
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=LintResponse,
    summary="Lint an ad-hoc OpenAPI specification",
    description=(
        "Runs Stoplight Spectral against the raw spec JSON provided in the request body. "
        "No spec is saved; this is useful for live editor validation. "
        "The user's default ruleset (if configured) is applied automatically."
    ),
)
def lint_spec_adhoc(
    body: LintRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    spectral_client: SpectralClient = Depends(spectral_client_dependency),
) -> LintResponse:
    return LintService(db, spectral_client).lint(body.spec_json, current_user.id)


@router.post(
    "/preview-rule",
    response_model=LintResponse,
    summary="Test a single unsaved draft rule against spec content",
    description=(
        "Runs one draft StructuredRule (not a saved ruleset) against the provided spec JSON. "
        "Used by the ruleset editor for immediate per-rule feedback while authoring; nothing "
        "is persisted and `spectral:oas` is not applied, so only this rule's matches are returned."
    ),
)
def preview_rule(
    body: LintPreviewRuleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    spectral_client: SpectralClient = Depends(spectral_client_dependency),
) -> LintResponse:
    if not isinstance(body.spec_json, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="spec_json must be a JSON object",
        )
    return LintService(db, spectral_client).preview_rule(body.spec_json, body.rule)


# ---------------------------------------------------------------------------
# Ruleset management endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/rulesets",
    response_model=list[LintRulesetSummary],
    summary="List the current user's lint rulesets",
)
def list_lint_rulesets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LintRulesetSummary]:
    rows = LintRulesetRepository(db).list(current_user.id)
    return [_to_summary(r) for r in rows]


@router.post(
    "/rulesets",
    response_model=LintRulesetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new lint ruleset",
    description=(
        "Creates a new named Spectral ruleset for the authenticated user. "
        "The first ruleset a user creates becomes their default automatically."
    ),
)
def create_lint_ruleset(
    body: LintRulesetUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LintRulesetResponse:
    if not body.name or not body.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A ruleset name is required.",
        )
    _validate_raw_yaml(body.raw_yaml)
    rules_json = (
        [r.model_dump() for r in body.rules] if body.rules is not None else None
    )
    row = LintRulesetRepository(db).create(
        current_user.id, body.name.strip(), rules_json, body.raw_yaml
    )
    return _to_response(row)


@router.get(
    "/rulesets/{ruleset_id}",
    response_model=LintRulesetResponse,
    summary="Get one of the current user's lint rulesets",
)
def get_lint_ruleset(
    ruleset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LintRulesetResponse:
    row = LintRulesetRepository(db).get(current_user.id, ruleset_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ruleset not found."
        )
    return _to_response(row)


@router.put(
    "/rulesets/{ruleset_id}",
    response_model=LintRulesetResponse,
    summary="Update a lint ruleset",
    description=(
        "Updates a ruleset's name and/or rule content. "
        "If `raw_yaml` is provided it must be valid YAML syntax — a 400 is returned otherwise. "
        "When `raw_yaml` is present it takes precedence over `rules` at lint time."
    ),
)
def update_lint_ruleset(
    ruleset_id: str,
    body: LintRulesetUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LintRulesetResponse:
    _validate_raw_yaml(body.raw_yaml)
    rules_json = (
        [r.model_dump() for r in body.rules] if body.rules is not None else None
    )
    row = LintRulesetRepository(db).update(
        current_user.id,
        ruleset_id,
        name=body.name.strip() if body.name else None,
        rules_json=rules_json,
        raw_yaml=body.raw_yaml,
        rules_provided="rules" in body.model_fields_set,
        raw_yaml_provided="raw_yaml" in body.model_fields_set,
    )
    return _to_response(row)


@router.delete(
    "/rulesets/{ruleset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a lint ruleset",
    description=(
        "Removes a ruleset. Fails with 409 if it's assigned to any spec, or if it's the "
        "user's default ruleset and other rulesets exist (pick a new default first)."
    ),
)
def delete_lint_ruleset(
    ruleset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    LintRulesetRepository(db).delete(current_user.id, ruleset_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/rulesets/{ruleset_id}/set-default",
    response_model=LintRulesetResponse,
    summary="Mark a ruleset as the user's default",
    description="Specs with no explicit ruleset assignment fall back to whichever ruleset is default.",
)
def set_default_lint_ruleset(
    ruleset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LintRulesetResponse:
    row = LintRulesetRepository(db).set_default(current_user.id, ruleset_id)
    return _to_response(row)


# ---------------------------------------------------------------------------
# Spec ↔ ruleset assignment
# ---------------------------------------------------------------------------


@router.put(
    "/spec/{spec_id}/ruleset",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Assign (or clear) a spec's pinned ruleset",
    description=(
        "Pins `ruleset_id` as the ruleset used when linting this spec, overriding the "
        "user's default. Pass `ruleset_id: null` to clear the override and fall back to default."
    ),
)
def assign_spec_ruleset(
    spec_id: str,
    body: SpecRulesetAssignRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    spec = (
        db.query(OpenAPISpec)
        .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == current_user.id)
        .first()
    )
    if spec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spec with id {spec_id} not found",
        )

    if body.ruleset_id is not None:
        ruleset = LintRulesetRepository(db).get(current_user.id, body.ruleset_id)
        if ruleset is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Ruleset not found."
            )

    spec.active_ruleset_id = body.ruleset_id
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Lint-by-spec-id endpoints (catch-all path params — must stay last; see the
# ordering note at the top of this file)
# ---------------------------------------------------------------------------


@router.post(
    "/{spec_id}",
    response_model=LintResponse,
    summary="Lint a stored OpenAPI specification",
    description=(
        "Runs Stoplight Spectral against the OpenAPI spec identified by `spec_id`. "
        "The spec must belong to the authenticated user. The spec's assigned ruleset "
        "(or the user's default ruleset) is applied automatically."
    ),
)
def lint_spec_by_id(
    spec_id: str,
    version: str = Query(
        ...,
        description="Version of the spec to lint (required)",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    spectral_client: SpectralClient = Depends(spectral_client_dependency),
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

    return LintService(db, spectral_client).lint(
        spec_version.content, current_user.id, spec_id=spec_id
    )


@router.post(
    "/{spec_id}/lint-draft",
    response_model=LintResponse,
    summary="Lint an unsaved draft for an existing spec",
    description=(
        "Runs Stoplight Spectral against a draft OpenAPI spec provided in the request body. "
        "The `spec_id` is used both to confirm the user has access to the spec and to resolve "
        "its assigned ruleset (or the user's default ruleset); the draft itself is not stored."
    ),
)
def lint_draft(
    spec_id: str,
    body: LintRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    spectral_client: SpectralClient = Depends(spectral_client_dependency),
) -> LintResponse:
    # Ownership check via SpecService (raises 404 if absent or not owned)
    spec_service = SpecService(db)
    spec_service.get_spec(current_user, spec_id)

    if not isinstance(body.spec_json, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="spec_json must be a JSON object",
        )

    return LintService(db, spectral_client).lint(
        body.spec_json, current_user.id, spec_id=spec_id
    )
