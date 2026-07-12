# Backend Implementation

Location: [`backend`](backend:1)

**Note (2026-07-12):** this document previously described Redis as the spec
datastore and an example MCP server under a `backend/mcp/` directory. Neither
is accurate — see the corrected content below. For the full architecture
picture see [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

Overview

- Backend is a FastAPI application that exposes auth, spec, and lint
  endpoints, and mounts a FastMCP server into the same ASGI app.
- Main entrypoint: [`backend/main.py`](backend/main.py:1), which sets up the FastAPI app and mounts routers.
- Deployed as a Docker-image AWS Lambda behind a Function URL via Mangum — see [`backend/lambda_handler.py`](backend/lambda_handler.py:1).

Key files

- [`backend/main.py`](backend/main.py:1) — app instantiation and router registration (routers mounted at `/auth`, `/specs`, `/lint`).
- [`backend/app.py`](backend/app.py:1) — merges the FastAPI app and the FastMCP server into one ASGI app.
- [`backend/models.py`](backend/models.py:1) — SQLAlchemy ORM models used to persist specs, versions, users, API keys, and auth tokens in PostgreSQL.
- [`backend/schemas.py`](backend/schemas.py:1) — Pydantic models for request/response validation.
- [`backend/database.py`](backend/database.py:1) — database connection and session management (PostgreSQL only — RDS in deployed environments).
- [`backend/auth/`](backend/auth:1) — authentication helpers: [`backend/auth/jwt.py`](backend/auth/jwt.py:1) and `dependencies.py`. Google sign-in lives in `backend/routers/auth.py`, not a separate `oauth.py` flow module (GitHub OAuth was removed).
- [`backend/routers/`](backend/routers:1) — `auth.py`, `specs.py`, and `lint.py` routers defining HTTP endpoints (notable: [`backend/routers/auth.py`](backend/routers/auth.py:1) contains Google OAuth and API key / short-JWT flows).
- [`backend/validation/`](backend/validation:1) — `spectral_client.py` (Spectral lint transport), `diff_utils.py` (version diffing).
- [`backend/fastmcp_server/`](backend/fastmcp_server:1) — the FastMCP server, mounted into the same ASGI app (see [`backend/fastmcp_server/server.py`](backend/fastmcp_server/server.py:1)); not a separate process.

Run locally (development)

- Install dependencies from `backend/requirements.txt`.
- Start dev server: `make backend` (from the repo root), or `uvicorn main:app --reload --host 0.0.0.0 --port 8000` from inside `backend/`.

Authentication

- JWT handling: token creation/verification in [`backend/auth/jwt.py`](backend/auth/jwt.py:1).
- Dependency injection: [`backend/auth/dependencies.py`](backend/auth/dependencies.py:1) defines `get_current_user` and other helpers used by routers.
- Google sign-in: server-side OAuth 2.0 Authorization Code redirect flow implemented directly in [`backend/routers/auth.py`](backend/routers/auth.py:1) — see [`docs/AUTHENTICATION.md`](AUTHENTICATION.md) for the full flow. GitHub OAuth has been removed.
- API key / short JWT flows: the auth router includes endpoints to create/list/revoke API keys and to exchange a raw API key for a short-lived JWT (used by MCP clients). See [`backend/routers/auth.py`](backend/routers/auth.py:1).

MCP server notes

- The FastMCP server lives in [`backend/fastmcp_server/server.py`](backend/fastmcp_server/server.py:1) and is mounted into the same ASGI app as the FastAPI backend (see [`backend/app.py`](backend/app.py:1)) — it is not a separate process or a standalone example.
- Tool calls are authenticated via short-lived JWTs, verified in [`backend/fastmcp_server/authentication.py`](backend/fastmcp_server/authentication.py:1) / `middleware.py`.
- Clients obtain a short-lived JWT by exchanging a long-lived API key via `POST /auth/api-keys/exchange` (see [`backend/routers/auth.py`](backend/routers/auth.py:1)).

Validation, linting, and diff

- [`backend/validation/spectral_client.py`](backend/validation/spectral_client.py:1) implements the `SpectralClient` protocol seam (subprocess or HTTP-sidecar transport) used by the lint router/service to validate specs against Spectral rulesets.
- [`backend/validation/diff_utils.py`](backend/validation/diff_utils.py:1) computes structured diffs between spec versions. The frontend displays diffs using the `DiffDrawer` component.

Specs persistence (PostgreSQL)

Specs, versions, users, API keys, and auth tokens are persisted in
PostgreSQL via SQLAlchemy models in [`backend/models.py`](backend/models.py:1),
with schema managed by Alembic migrations under `backend/alembic/versions/`.
There is no Redis anywhere in this codebase — `backend/auth/redis_client.py`
does not exist, and `REDIS_HOST`/`REDIS_PORT` are not read by the
application.

**Relevant files:**
- [`backend/services/spec_service.py`](backend/services/spec_service.py:1) — spec CRUD logic
- [`backend/database.py`](backend/database.py:1) — SQLAlchemy engine/session setup
- [`backend/routers/specs.py`](backend/routers/specs.py:1) — API endpoints for specs
- [`backend/schemas.py`](backend/schemas.py:1) — spec schemas

Extending backend

- Add new routes under [`backend/routers/`](backend/routers:1) and corresponding schemas in [`backend/schemas.py`](backend/schemas.py:1).
- New lint/validation logic: extend [`backend/validation/`](backend/validation:1); see `docs/CODE_REVIEW.md` for known gaps (e.g. `raw_yaml` ruleset validation).
