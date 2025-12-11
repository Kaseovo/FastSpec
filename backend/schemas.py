"""
Pydantic schemas for FastSpec API
"""

from pydantic import BaseModel, Field, field_validator
from typing import Dict, Any, List, Optional
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

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Schema for JWT token response"""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    """Schema for JWT token data"""

    user_id: Optional[int] = None
    email: Optional[str] = None


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
    """Schema for updating a spec"""

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

    id: int
    name: str
    title: str
    version: str
    spec_json: Dict[str, Any]
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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
