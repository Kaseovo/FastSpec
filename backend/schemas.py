"""
Pydantic schemas for FastSpec API
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Dict, Any, List, Literal, Optional
from datetime import datetime


class ValidationError(BaseModel):
    """Validation error detail"""

    field: str
    message: str


class ValidationResponse(BaseModel):
    """Response for spec validation"""

    valid: bool
    errors: List[ValidationError] = []
    warnings: List[str] = []


# Authentication Schemas
class UserBase(BaseModel):
    """Base schema for user"""

    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    """Schema for user response"""

    id: int
    provider: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """Schema for JWT token response"""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    """Schema for JWT token data"""

    user_id: Optional[int] = None
    email: Optional[str] = None


class ApiKeyActionsUpdateRequest(BaseModel):
    """Request schema for updating api_key actions by id (payload only contains actions)"""

    actions: List[str]


class ApiKeyActionsResponse(BaseModel):
    """Response schema after updating api_key actions"""

    message: str
    actions: List[str]


# OpenAPI Spec Schemas
class OpenAPISpecBase(BaseModel):
    """Base schema for OpenAPI spec"""

    name: str = Field(..., min_length=1, max_length=255)
    spec_json: Dict[str, Any]

    @field_validator("spec_json")
    @classmethod
    def validate_spec_json(cls, v):
        if not isinstance(v, dict):
            raise ValueError("spec_json must be a JSON object")
        return v


class OpenAPISpecCreate(OpenAPISpecBase):
    """Schema for creating a new spec"""

    pass


class OpenAPISpecUpdate(BaseModel):
    """Schema for updating a spec. Requires the base version the client is
    updating from to enable optimistic concurrency control."""

    # version is required and must be provided by clients to ensure they are
    # updating against the latest published version
    version: str = Field(..., min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    spec_json: Optional[Dict[str, Any]] = None

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
    spec_json: Dict[str, Any]
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiffResponse(BaseModel):
    """Schema for diff response"""

    has_changes: bool
    message: Optional[str] = None
    added_endpoints: Optional[List[Dict[str, Any]]] = None
    removed_endpoints: Optional[List[Dict[str, Any]]] = None
    modified_endpoints: Optional[List[Dict[str, Any]]] = None
    info_changes: Optional[Dict[str, Any]] = None


class MarkdownDiffResponse(BaseModel):
    """Schema for markdown diff response"""

    markdown: str


# Spec Versioning Schemas
class SpecVersionCreate(BaseModel):
    version: str
    content: Dict[str, Any]
    meta: Optional[Dict[str, Any]] = None


class SpecVersionResponse(BaseModel):
    id: str
    spec_id: str
    version: str
    content: Dict[str, Any]
    created_by: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Lint / Spectral Schemas


class LintRange(BaseModel):
    """Source range (line/character) for a lint result"""

    line: Optional[int] = None
    character: Optional[int] = None


class LintRangeSpan(BaseModel):
    """Start and optional end of a source range"""

    start: Optional[LintRange] = None
    end: Optional[LintRange] = None


class LintResult(BaseModel):
    """A single Spectral lint result"""

    code: str
    message: str
    severity: str  # 'error' | 'warn' | 'info' | 'hint'
    path: List[Any] = []
    range: Optional[LintRangeSpan] = None


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
    results: List[LintResult] = []


class LintRequest(BaseModel):
    """Request body for ad-hoc POST /lint"""

    spec_json: Dict[str, Any]
    ruleset: Optional[str] = "spectral:oas"


# Lint Ruleset Management Schemas

SPECTRAL_FUNCTIONS = Literal[
    "truthy", "falsy", "pattern", "enumeration", "length", "schema"
]


class StructuredRule(BaseModel):
    """A single structured lint rule built via the rule-form UI."""

    name: str = Field(..., min_length=1, max_length=128, description="Unique rule key")
    severity: Literal["error", "warn", "info", "hint", "off"] = "warn"
    given: str = Field(
        ..., min_length=1, description="JSONPath selector, e.g. $.paths[*][*]"
    )
    message: Optional[str] = Field(None, description="Optional custom message template")
    then_function: SPECTRAL_FUNCTIONS = Field(
        ..., description="Built-in Spectral function name"
    )
    then_function_options: Optional[Dict[str, Any]] = Field(
        None,
        description="Options passed to then_function (e.g. {match: '^[a-z]+'} for pattern)",
    )


class LintRulesetUpsertRequest(BaseModel):
    """Request body for PUT /lint/ruleset."""

    rules: Optional[List[StructuredRule]] = Field(
        None, description="Structured rules built via the form UI"
    )
    raw_yaml: Optional[str] = Field(
        None,
        description="Raw Spectral YAML override; takes precedence over rules when present",
    )


class LintRulesetResponse(BaseModel):
    """Response body for GET /lint/ruleset."""

    rules: Optional[List[StructuredRule]] = None
    raw_yaml: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
