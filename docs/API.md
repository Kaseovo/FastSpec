# HTTP API

The complete, always-current reference is the OpenAPI document every
instance serves: interactive at **`/docs`** (Swagger UI) or **`/redoc`**,
raw at **`/openapi.json`**. This page covers what that reference doesn't:
how to reach the API and authenticate.

## Base paths

| Prefix | Contents |
|---|---|
| `/api/specs`, `/api/lint` | Specs, versions, diffs, linting, rulesets. The `/api` prefix is stripped before routing, so `/docs` lists these as `/specs/…` and `/lint/…`. |
| `/auth` | Sign-in, sessions, API keys. |
| `/mcp` | MCP server (streamable HTTP) — see [SELF_HOSTING.md](SELF_HOSTING.md#connecting-ai-agents-mcp). |
| `/health`, `/health/ready`, `/version` | Liveness, readiness (checks the database), version and source URL. Also under `/api/`. |

## Authentication

Send `Authorization: Bearer <token>`, where the token is either:

- a **session JWT** — what the web app uses; or
- a **short JWT** from `POST /auth/api-keys/exchange`, for scripts: create
  an API key in the app (key icon, **API keys**), exchange it, and use the
  result for up to `SHORT_JWT_TTL_SECONDS` (5 minutes by default).

```bash
curl -s -X POST https://fastspec.example.com/auth/api-keys/exchange \
  -H 'Content-Type: application/json' -d '{"api_key": "<your key>"}'
# → {"access_token": "<short JWT>", "expires_at": "…"}

curl -s https://fastspec.example.com/api/specs/ \
  -H 'Authorization: Bearer <short JWT>'
```

A missing or invalid token gets `401 Unauthorized`. See
[AUTHENTICATION.md](AUTHENTICATION.md) for how sessions and keys work.

## Resources at a glance

| Area | Endpoints |
|---|---|
| Specs | `GET/POST /specs/`, `GET/PUT/DELETE /specs/{spec_id}`, `POST /specs/validate` |
| Versions | `GET/POST /specs/{spec_id}/versions`, `GET/PUT/DELETE /specs/{spec_id}/versions/{version_id}`, `POST …/{version_id}/publish` |
| Diffs | `GET /specs/{spec_id}/diff`, `POST /specs/{spec_id}/compare` (structured diff plus Markdown) |
| Linting | `POST /lint/{spec_id}` (stored version), `POST /lint/{spec_id}/lint-draft` (unsaved content), `POST /lint` (any spec), `POST /lint/preview-rule` |
| Rulesets | `GET/POST /lint/rulesets`, `GET/PUT/DELETE /lint/rulesets/{ruleset_id}`, `POST …/{ruleset_id}/set-default`, `PUT /lint/spec/{spec_id}/ruleset` |
| Sign-in | `GET /auth/config`, `POST /auth/local/session` (single-user mode), `GET /auth/oidc/login`, `GET /auth/oidc/callback`, `GET /auth/me`, `POST /auth/logout` |
| API keys | `GET/POST /auth/api-keys`, `DELETE /auth/api-keys/{id}`, `PUT /auth/api-keys/{id}/actions`, `POST /auth/api-keys/exchange`, `POST /auth/api-keys/revoke`, `GET /auth/actions` |

Custom lint rulesets are described in
[CUSTOM_LINT_RULES.md](CUSTOM_LINT_RULES.md).
