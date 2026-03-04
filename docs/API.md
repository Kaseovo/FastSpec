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
- On success: 201 Created with `OpenAPISpecResponse` and creates the initial version for the spec automatically (no separate call required).
- Response includes `initial_version` field with details of the created version.
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

- Versions and comparison endpoints

- GET /specs/{spec_id}/versions
  - Returns: List of `SpecVersionResponse` ordered by `created_at` descending.
  - Auth: same as GET /specs/{spec_id} (read access).
  - Example response:

```json
[
  {
    "id": "uuid-1",
    "spec_id": 1,
    "version": "1.0.0",
    "created_at": "2026-02-01T12:00:00Z",
    "is_published": true,
    "content": { "paths": {} }
  }
]
```

- POST /specs/{spec_id}/versions
  - Body: `SpecVersionCreate` ({"version": "1.0.0", "content": {...}, "metadata": {...}})
  - Validates uniqueness of (spec_id, version). On conflict returns 409.
  - On success returns 201 with `SpecVersionResponse`.

- GET /specs/{spec_id}/versions/{version_or_id}
  - `version_or_id` may be a UUID id or a version string such as "1.0.0". The server will try to parse as UUID and fall back to version string lookup.
  - Returns `SpecVersionResponse`.

- DELETE /specs/{spec_id}/versions/{version_or_id}
  - Deletes the specified version. Only allowed by the creator of the version or the spec owner.
  - If the version is the last published version and the spec has a live pointer, deletion is forbidden unless caller has admin rights (403).
  - On success returns 204 No Content.

- POST /specs/{spec_id}/compare
  - Body: {"base": "<id-or-version>", "compare": "<id-or-version>"}
  - Returns JSON: {"base": SpecVersionResponse, "compare": SpecVersionResponse, "diff": {...}}
  - Uses `compare_specs(base.content, compare.content)` from `backend/validation/diff_utils.py` to compute the diff.

- POST /specs/{spec_id}/versions/{version_or_id}/publish
  - Marks the version as published (`is_published=true`) and updates the spec's `version` pointer to this version.
  - Auth: spec owner or version creator.
  - Returns `SpecVersionResponse`.

Error responses

- 400 Bad Request: invalid input or validation failures. The body includes `errors` and `warnings` where applicable.
- 401 Unauthorized: missing/invalid token.
- 403 Forbidden: permission denied (e.g., trying to delete a published live version without admin rights).
- 404 Not Found: resource not found or not owned by user.

Schemas reference

- `backend/schemas.py` contains Pydantic schemas used by these endpoints (OpenAPISpecCreate, OpenAPISpecUpdate, OpenAPISpecResponse, ValidationResponse, SpecVersionCreate, SpecVersionResponse, DiffResponse, MarkdownDiffResponse).

Implementation notes

- Authentication is enforced via FastAPI dependencies (`get_current_user`) declared in `backend/auth/dependencies.py`.
- Version comparison uses `backend/validation/diff_utils.compare_specs` which returns a structured JSON diff used by the `/specs/{id}/compare` endpoint.
- Create/publish/delete operations use DB transactions and handle unique constraint violations (returning 409 on conflict).

## Lint endpoints

- POST /lint/{spec_id}
  - Query params:
    - `version` (string, required): The spec version to lint
    - `ruleset` (string, optional): Spectral ruleset identifier or URL (default: spectral:oas)
  - Auth: Requires JWT via dependency `get_current_user`.
  - Returns: `{ score, summary, results }` for the specified spec version
  - Errors:
    - 404 if spec or version not found or not owned by user
  - Example:
    ```http
    POST /lint/6e7976e1-facb-4dd5-8f98-5dabc0a15b41?version=1.0.0&ruleset=spectral:oas
    Authorization: Bearer <token>
    ```

- POST /lint
  - Body: `{ spec_json: object, ruleset?: string }`
  - Auth: Requires JWT via dependency `get_current_user`.
  - Returns: `{ score, summary, results }` for the provided spec JSON
  - Example:
    ```http
    POST /lint
    Content-Type: application/json
    Authorization: Bearer <token>
    {
      "spec_json": { ... },
      "ruleset": "spectral:oas"
    }
    ```
