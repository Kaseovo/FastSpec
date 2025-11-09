from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class OpenAPISpecBase(BaseModel):
    name: str = Field(..., description="Unique identifier name for the spec")
    spec_json: Dict[str, Any] = Field(..., description="The OpenAPI JSON specification")


class OpenAPISpecCreate(OpenAPISpecBase):
    pass


class OpenAPISpecUpdate(BaseModel):
    name: Optional[str] = None
    spec_json: Optional[Dict[str, Any]] = None


class OpenAPISpecResponse(BaseModel):
    id: int
    name: str
    title: str
    version: str
    spec_json: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ValidationError(BaseModel):
    field: str
    message: str


class ValidationResponse(BaseModel):
    valid: bool
    errors: List[ValidationError] = []
    warnings: List[str] = []
