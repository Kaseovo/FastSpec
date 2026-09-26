"""
Pydantic schemas for FastSpec API
"""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ValidationError(BaseModel):
    """Validation error detail"""

    field: str
    message: str


class ValidationResponse(BaseModel):
    """Response for spec validation"""

    valid: bool
    errors: list[ValidationError] = []
    warnings: list[str] = []


# Authentication Schemas
class UserBase(BaseModel):
    """Base schema for user"""

    email: str
    name: str | None = None
    avatar_url: str | None = None


class UserResponse(UserBase):
    """Schema for user response"""

    id: int
    provider: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiKeyActionsUpdateRequest(BaseModel):
    """Request schema for updating api_key actions and optional name by id"""

    actions: list[str]
    name: str | None = None


class ApiKeyActionsResponse(BaseModel):
    """Response schema after updating api_key actions"""

    message: str
    actions: list[str]
    name: str | None = None


# OpenAPI Spec Schemas
class OpenAPISpecBase(BaseModel):
    """Base schema for OpenAPI spec"""

    name: str = Field(..., min_length=1, max_length=255)
    spec_json: dict[str, Any]

    @field_validator("spec_json")
    @classmethod
    def validate_spec_json(cls, v):
        if not isinstance(v, dict):
            raise ValueError("spec_json must be a JSON object")
        return v


class OpenAPISpecCreate(OpenAPISpecBase):
    """Schema for creating a new spec"""

    version: str | None = Field(
        None,
        min_length=1,
        max_length=50,
        description="Version for the new spec. Preferred over the deprecated ?version= query param.",
    )


class OpenAPISpecUpdate(BaseModel):
    """Schema for updating a spec. Requires the base version the client is
    updating from to enable optimistic concurrency control: the update is
    rejected with 409 if `version` doesn't match the spec's current version."""

    # version is required and must be provided by clients to ensure they are
    # updating against the latest published version
    version: str = Field(..., min_length=1, max_length=50)
    name: str | None = Field(None, min_length=1, max_length=255)
    spec_json: dict[str, Any] | None = None

    @field_validator("spec_json")
    @classmethod
    def validate_spec_json(cls, v):
        if v is not None and not isinstance(v, dict):
            raise ValueError("spec_json must be a JSON object")
        return v


class OpenAPISpecResponse(BaseModel):
    """Schema for spec response"""

    id: str
    name: str
    title: str
    version: str
    spec_json: dict[str, Any]
    user_id: int
    active_ruleset_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SpecDiffResponse(BaseModel):
    """Response for GET /specs/{id}/diff.

    Exactly one shape applies per request: `has_changes`/`message` when
    there's no previous version to compare, `markdown` when
    output_format=markdown, or `diff` for the default structured JSON diff
    (see validation.diff_utils.compare_specs for its keys).
    """

    has_changes: bool | None = None
    message: str | None = None
    markdown: str | None = None
    diff: dict[str, Any] | None = None


class SpecCompareResponse(BaseModel):
    """Response for POST /specs/{id}/compare.

    `compare` is null when comparing against an inline draft rather than a
    stored version. `markdown` is always populated (rendered server-side
    from `diff` via validation.diff_utils.generate_markdown_report) so
    callers needing a human-readable report don't have to reimplement the
    formatting client-side. When options.format == "markdown", `diff` is
    omitted and only `markdown` is returned.
    """

    base: "SpecVersionResponse"
    compare: Optional["SpecVersionResponse"] = None
    diff: dict[str, Any] | None = None
    markdown: str | None = None


# Spec Versioning Schemas
class SpecVersionCreate(BaseModel):
    version: str
    content: dict[str, Any]
    meta: dict[str, Any] | None = None


class SpecVersionResponse(BaseModel):
    id: str
    spec_id: str
    version: str
    content: dict[str, Any]
    created_by: int | None = None
    meta: dict[str, Any] | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Lint / Spectral Schemas


class LintRange(BaseModel):
    """Source range (line/character) for a lint result"""

    line: int | None = None
    character: int | None = None


class LintRangeSpan(BaseModel):
    """Start and optional end of a source range"""

    start: LintRange | None = None
    end: LintRange | None = None


class LintResult(BaseModel):
    """A single Spectral lint result"""

    code: str
    message: str
    severity: str  # 'error' | 'warn' | 'info' | 'hint'
    path: list[Any] = []
    range: LintRangeSpan | None = None


class LintSummary(BaseModel):
    """Count of results by severity"""

    error: int = 0
    warn: int = 0
    info: int = 0
    hint: int = 0


class LintResponse(BaseModel):
    """Full lint response returned by POST /lint endpoints"""

    score: int = Field(..., ge=0, le=100, description="Quality score 0–100")
    summary: LintSummary
    results: list[LintResult] = []


class LintRequest(BaseModel):
    """Request body for ad-hoc POST /lint"""

    spec_json: dict[str, Any]


# Lint Ruleset Management Schemas

SPECTRAL_FUNCTIONS = Literal[
    "truthy",
    "falsy",
    "pattern",
    "enumeration",
    "length",
    "schema",
    "casing",
    "alphabetical",
    "xor",
    "unreferencedReusableObject",
]


class StructuredRule(BaseModel):
    """A single structured lint rule built via the rule-form UI."""

    name: str = Field(..., min_length=1, max_length=128, description="Unique rule key")
    severity: Literal["error", "warn", "info", "hint", "off"] = "warn"
    given: str = Field(
        ..., min_length=1, description="JSONPath selector, e.g. $.paths[*][*]"
    )
    message: str | None = Field(None, description="Optional custom message template")
    then_function: SPECTRAL_FUNCTIONS = Field(
        ..., description="Built-in Spectral function name"
    )
    then_function_options: dict[str, Any] | None = Field(
        None,
        description="Options passed to then_function (e.g. {match: '^[a-z]+'} for pattern)",
    )


class LintRulesetUpsertRequest(BaseModel):
    """Request body for POST/PUT /lint/rulesets — create or update a named ruleset."""

    name: str | None = Field(
        None, min_length=1, max_length=255, description="Ruleset display name"
    )
    rules: list[StructuredRule] | None = Field(
        None, description="Structured rules built via the form UI"
    )
    raw_yaml: str | None = Field(
        None,
        description="Raw Spectral YAML override; takes precedence over rules when present",
    )


class LintRulesetResponse(BaseModel):
    """Full ruleset body, returned by the single-ruleset GET/POST/PUT endpoints."""

    id: str
    name: str
    is_default: bool
    rules: list[StructuredRule] | None = None
    raw_yaml: str | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class LintRulesetSummary(BaseModel):
    """Lightweight ruleset listing entry, returned by GET /lint/rulesets."""

    id: str
    name: str
    is_default: bool
    rule_count: int
    has_raw_yaml: bool
    updated_at: datetime | None = None


class SpecRulesetAssignRequest(BaseModel):
    """Request body for PUT /lint/spec/{spec_id}/ruleset."""

    ruleset_id: str | None = Field(
        None,
        description="Ruleset to pin to this spec, or null to fall back to the user's default ruleset",
    )


class LintPreviewRuleRequest(BaseModel):
    """Request body for POST /lint/preview-rule — test one draft rule without saving it."""

    spec_json: dict[str, Any]
    rule: StructuredRule
