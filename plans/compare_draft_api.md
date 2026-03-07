# API for comparing an unsaved draft with a stored version

This document describes the minimal backend API surface the frontend needs to compare an unsaved editor draft (not yet saved as a version) with a stored spec version.

References

- Backend router: [`backend/routers/specs.py`](backend/routers/specs.py:1)
- Diff utilities: [`backend/validation/diff_utils.py`](backend/validation/diff_utils.py:1)
- Frontend client: [`frontend/src/api/specs.js`](frontend/src/api/specs.js:1)

Principles

- All endpoints require authenticated requests (Authorization: Bearer <token>) and enforce permission checks.
- The frontend should be able to: list versions, fetch a base version, and send the editor JSON as a compare payload to receive a structured diff (or other formats).

Endpoints

1. List versions

- GET /api/specs/{spec_id}/versions
- Response: array of version metadata

```json
[
  {
    "id": "uuid",
    "version": "1.2.0",
    "created_by": "user-id",
    "created_at": "2026-03-06T...Z",
    "is_published": true
  }
]
```

2. Get a specific version

- GET /api/specs/{spec_id}/versions/{version_id}
- Response: full version payload

```json
{
  "id": "uuid",
  "version": "1.2.0",
  "content": {
    /* OpenAPI JSON */
  },
  "meta": {},
  "created_by": "...",
  "created_at": "..."
}
```

3. Compare draft (recommended primary endpoint)

- POST /api/specs/{spec_id}/compare
- Purpose: compare a stored base (by id or special token) against either another stored version or an unsaved draft provided inline.

Request body (examples):

```json
{
  "base": "<version_id|live|latest>",
  "compare": "<version_id>" // optional if comparing two stored versions
}
```

or (compare unsaved draft):

```json
{
  "base": "<version_id|live|latest>",
  "compare_content": {
    /* full OpenAPI JSON draft from editor */
  },
  "options": {
    "format": "structured", // structured | markdown | patch | unified
    "diff_type": "semantic" // text | semantic
  }
}
```

Response (canonical structured JSON):

```json
{
  "base": { "id": "...", "version": "1.2.0", "created_at": "..." },
  "compare": { "id": null, "is_draft": true },
  "diff": {
    "has_changes": true,
    "added": [],
    "removed": [],
    "modified": [
      {
        "path": "/pets",
        "method": "get",
        "summary_changed": true,
        "summary_old": "old",
        "summary_new": "new",
        "request_body_changes": { "has_changes": false },
        "response_changes": {
          "200": {
            "has_changes": true,
            "added_fields": [],
            "removed_fields": [],
            "modified_fields": []
          }
        }
      }
    ],
    "infoAdded": [],
    "infoModified": [],
    "infoRemoved": []
  }
}
```

Notes

- The existing `POST /{spec_id}/compare` in [`backend/routers/specs.py`](backend/routers/specs.py:1) already supports comparing two stored versions; extend it to accept `compare_content` for unsaved drafts so the frontend can send editor state without saving.
- Support `options.format = "patch"` to return RFC 6902 JSON Patch when useful for client-side preview/apply flows.
- Support `options.diff_type = "semantic"` to return higher-level semantic diffs (experimental).
- Provide `format=markdown` as a server-rendered human-readable report (already supported by `GET /{spec_id}/diff` — see [`backend/routers/specs.py`](backend/routers/specs.py:1)).

Error codes

- 400: invalid payload
- 401: unauthenticated
- 403: not permitted to access this spec/version
- 404: base or compare version not found

Frontend usage example

- Add a helper in the frontend client to call the compare endpoint with editor content. Update [`frontend/src/api/specs.js`](frontend/src/api/specs.js:1) with a function like:

```javascript
// frontend/src/api/specs.js
export const compareDraftWithVersion = async (
  specId,
  baseVersionId,
  draftContent,
  options = {},
) => {
  const payload = {
    base: baseVersionId,
    compare_content: draftContent,
    options,
  };
  const resp = await api.post(`/${specId}/compare`, payload);
  return resp.data; // { base, compare, diff }
};
```

UI flow

- Editor opens; fetch available base versions via `GET /{spec_id}/versions`.
- When user requests "Compare draft with version": call `compareDraftWithVersion` sending editor JSON as `compare_content`.
- Render `diff` using an existing diff renderer or the structured diff format (group by endpoints, show added/removed fields).

Performance considerations

- Allow the backend to return a summary only (e.g., top-level has_changes + counts) and provide expanded sections on demand.
- For very large specs, support returning paged/sectioned diffs.

Next steps

- If you want, I can produce exact JSON Schema (OpenAPI) definitions for the request/response shapes and add the small client wrapper in [`frontend/src/api/specs.js`](frontend/src/api/specs.js:1).
