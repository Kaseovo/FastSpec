# API Reference (detailed)

This document describes endpoints implemented in `backend/routers/` with request/response shapes and example payloads.

Base path: application root. Specs router is mounted at `/specs`.

Authentication

- GET /auth/google
  - Redirects user to Google's OAuth2 consent page.
- GET /auth/google/callback
  - Callback URL used by Google to return authorization code. Exchanges code for tokens, creates or updates user, issues JWT and redirects to frontend with token as query param (`/?token=...`).
- GET /auth/github
  - Redirects user to GitHub's OAuth2 consent page.
- GET /auth/github/callback
  - Callback URL used by GitHub to return authorization code. Exchanges code for tokens, creates or updates user, issues JWT and redirects to frontend with token as query param.
- GET /auth/me
  - Requires Authorization header `Bearer <token>`.
  - Response: `UserResponse` (see `backend/schemas.py`).

Specs endpoints (mounted at `/specs`)

- GET /specs
  - Returns: List of `OpenAPISpecResponse` objects for the current user.
  - Auth: Requires JWT via dependency `get_current_user`.

- GET /specs/{spec_id}
  - Path params: `spec_id` (int)
  - Returns: `OpenAPISpecResponse` for the given spec id (404 if not found or not owned by user).

- POST /specs
  - Body: `OpenAPISpecCreate` (name: string, spec_json: JSON object).
  - Validates spec using `validate_openapi_spec` from `backend/validation/validator.py`. If invalid, returns 400 with structured errors.
  - If name already exists for the user, returns 400.
  - On success: 201 Created with `OpenAPISpecResponse`.
  - Example request body:

```json
{
  "name": "my-api",
  "spec_json": {
    "openapi": "3.0.0",
    "info": { "title": "My API", "version": "1.0.0" },
    "paths": {}
  }
}
```

- PUT /specs/{spec_id}
  - Body: `OpenAPISpecUpdate` (optional name, optional spec_json).
  - If spec_json present, validates new spec and stores previous spec in `previous_spec_json` before updating.
  - Returns updated `OpenAPISpecResponse`.

- DELETE /specs/{spec_id}
  - Deletes the spec if owned by the user. Returns 204 No Content.

- POST /specs/validate
  - Body: raw JSON object representing a spec.
  - Validates spec and returns `ValidationResponse` with `valid`, `errors`, `warnings`.

- GET /specs/{spec_id}/diff?format=json|markdown
  - Query param: `format` (default `json`). Valid values: `json`, `markdown`.
  - If no previous version exists, returns `has_changes: False` and message.
  - For `json` format: returns structured diff (see `backend/validation/diff_utils.py` for schema).
  - For `markdown` format: returns `markdown` string with a human-readable report.

Error responses

- 400 Bad Request: invalid input or validation failures. The body includes `errors` and `warnings` where applicable.
- 401 Unauthorized: missing/invalid token.
- 404 Not Found: resource not found or not owned by user.

Schemas reference

- `backend/schemas.py` contains Pydantic schemas used by these endpoints (OpenAPISpecCreate, OpenAPISpecUpdate, OpenAPISpecResponse, ValidationResponse, DiffResponse, MarkdownDiffResponse).

Implementation notes

- Authentication is enforced via FastAPI dependencies (`get_current_user`) declared in `backend/auth/dependencies.py`.
- Validation uses `openapi-spec-validator` and additional basic checks in `backend/validation/validator.py` before running full validation.
- Diff and markdown generation are implemented in `backend/validation/diff_utils.py` and are used by the `/specs/{id}/diff` endpoint.
