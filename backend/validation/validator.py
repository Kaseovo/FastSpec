from openapi_spec_validator import validate
from openapi_spec_validator.validation.exceptions import OpenAPIValidationError
from typing import Dict, Any, List, Tuple, NamedTuple


class ValidationError(NamedTuple):
    """Simple validation error class"""

    field: str
    message: str


def validate_openapi_spec(
    spec_json: Dict[str, Any],
) -> Tuple[bool, List[ValidationError], List[str]]:
    """
    Validate an OpenAPI specification.

    Returns:
        Tuple of (is_valid, errors, warnings)
    """
    errors = []
    warnings = []

    # Basic structure checks
    if not isinstance(spec_json, dict):
        errors.append(
            ValidationError(field="root", message="Spec must be a JSON object")
        )
        return False, errors, warnings

    # Check required fields
    if "openapi" not in spec_json:
        errors.append(
            ValidationError(
                field="openapi", message="Missing 'openapi' field (required)"
            )
        )

    if "info" not in spec_json:
        errors.append(
            ValidationError(field="info", message="Missing 'info' object (required)")
        )
    elif not isinstance(spec_json["info"], dict):
        errors.append(ValidationError(field="info", message="'info' must be an object"))
    else:
        if "title" not in spec_json["info"]:
            errors.append(
                ValidationError(
                    field="info.title", message="Missing 'info.title' (required)"
                )
            )
        if "version" not in spec_json["info"]:
            errors.append(
                ValidationError(
                    field="info.version", message="Missing 'info.version' (required)"
                )
            )

    if "paths" not in spec_json:
        errors.append(
            ValidationError(field="paths", message="Missing 'paths' object (required)")
        )

    # Check servers (optional but recommended)
    if "servers" not in spec_json or not spec_json.get("servers"):
        warnings.append(
            "No 'servers' defined - consider adding at least one server URL"
        )

    # If basic checks failed, return early
    if errors:
        return False, errors, warnings

    # Use openapi-spec-validator for comprehensive validation
    try:
        validate(spec_json)
        return True, errors, warnings
    except OpenAPIValidationError as e:
        # Parse validation errors
        error_msg = str(e)
        errors.append(
            ValidationError(
                field=error_msg.split(":")[0] if ":" in error_msg else "spec",
                message=error_msg,
            )
        )
        return False, errors, warnings
    except Exception as e:
        errors.append(
            ValidationError(field="spec", message=f"Validation error: {str(e)}")
        )
        return False, errors, warnings
