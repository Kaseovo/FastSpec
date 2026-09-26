import logging
from typing import Any, NamedTuple

from openapi_spec_validator import validate
from openapi_spec_validator.validation.exceptions import OpenAPIValidationError

logger = logging.getLogger(__name__)


class ValidationError(NamedTuple):
    """Simple validation error class"""

    field: str
    message: str


def validate_openapi_spec(
    spec_json: dict[str, Any],
) -> tuple[bool, list[ValidationError], list[str]]:
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
        # Use structured attributes when available
        path_attr = getattr(e, "path", None) or getattr(e, "schema_path", None)
        field = "spec"
        try:
            if isinstance(path_attr, (list, tuple)) and path_attr:
                field = ".".join(str(p) for p in path_attr)
            elif isinstance(path_attr, str) and path_attr:
                field = path_attr
        except Exception:
            field = "spec"

        error_msg = str(e)
        logger.warning("OpenAPI validation error on field %s: %s", field, error_msg)
        errors.append(ValidationError(field=field, message=error_msg))
        return False, errors, warnings
    except Exception as e:
        logger.exception("Unexpected error during OpenAPI validation")
        errors.append(
            ValidationError(field="spec", message=f"Validation error: {str(e)}")
        )
        return False, errors, warnings
