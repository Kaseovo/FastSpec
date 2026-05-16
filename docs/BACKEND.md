# Backend Implementation

Location: [`backend`](backend:1)

Overview

- Backend is a FastAPI application that exposes auth and spec-related endpoints.
- Main entrypoint: [`backend/main.py`](backend/main.py:1) which sets up the FastAPI app and mounts routers.

Key files

- [`backend/main.py`](backend/main.py:1) — app instantiation and router registration.
- [`backend/models.py`](backend/models.py:1) — ORM models or DB-layer structures used to persist specs and users.
- [`backend/schemas.py`](backend/schemas.py:1) — Pydantic models for request/response validation.
- [`backend/database.py`](backend/database.py:1) — database connection and session management.
- [`backend/auth/`](backend/auth:1) — authentication helpers: [`backend/auth/jwt.py`](backend/auth/jwt.py:1), `oauth.py`, and `dependencies.py`.
- [`backend/routers/`](backend/routers:1) — `auth.py` and `specs.py` routers defining HTTP endpoints (notable: [`backend/routers/auth.py`](backend/routers/auth.py:1) contains API key and short-JWT flows).
- [`backend/validation/`](backend/validation:1) — `validator.py` and `diff_utils.py` that implement validation rules and diff logic.
- [`backend/mcp/`](backend/mcp:1) — optional MCP server implementations; see [`backend/mcp/server.py`](backend/mcp/server.py:1) for an example.

Run locally (development)

- Install dependencies from `backend/requirements.txt`.
- Start dev server: uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

Authentication

- JWT handling: token creation/verification in [`backend/auth/jwt.py`](backend/auth/jwt.py:1).
- Dependency injection: [`backend/auth/dependencies.py`](backend/auth/dependencies.py:1) defines `get_current_user` and other helpers used by routers.
- OAuth: flows implemented in [`backend/auth/oauth.py`](backend/auth/oauth.py:1), which interacts with upstream OAuth providers.
- API key / short JWT flows: The auth router includes endpoints to create/list/revoke API keys and to exchange a raw API key for a short-lived JWT. See [`backend/routers/auth.py`](backend/routers/auth.py:1).

MCP server notes

- The repository contains an example MCP server under [`backend/mcp/server.py`](backend/mcp/server.py:1). The example demonstrates:
  - Declaring tools that the agent can call via MCP.
  - Verifying incoming JWTs with a `JWTVerifier` so MCP tools can be called only by authenticated clients.
  - A helper flow to obtain short-lived JWTs from the auth service using a configured `MCP_REFRESH_TOKEN` and `AUTH_SERVICE_URL`.
- Ensure the auth service exposes a compatible exchange endpoint if the MCP helper is to use refresh-token-based exchange; alternatively, adapt the MCP helper to call the existing API-key-based exchange endpoints.

Validation and diff

- [`backend/validation/validator.py`](backend/validation/validator.py:1) exposes validation functions that run a set of rules against spec content and return structured findings.
- [`backend/validation/diff_utils.py`](backend/validation/diff_utils.py:1) computes structured diffs between spec versions or arbitrary payloads. The frontend displays diffs using a `DiffDrawer` component.

Specs Persistence (Redis)

Specs are now persisted in Redis, not a traditional relational database. The [`SpecService`](backend/services/spec_service.py:12) handles all CRUD operations for OpenAPI specs using Redis as the backing store.

**Data Model:**
- Each spec is stored as a JSON blob at key `spec:<user_id>:<spec_id>`.
- Each user has a set `specs:<user_id>` containing all their spec IDs.
- The [`OpenAPISpecResponse`](backend/schemas.py:111) schema defines the structure of the stored spec object.

**Configuration:**
- Redis connection is configured via environment variables in [`backend/auth/redis_client.py`](backend/auth/redis_client.py:1):
  - `REDIS_HOST` (default: `localhost`)
  - `REDIS_PORT` (default: `6379`)
  - `REDIS_URL` (overrides host/port if set)
- Update these variables in your environment or `docker-compose.yml` as needed.

**Upgrade Notes:**
- Specs previously stored in a relational database are no longer used for CRUD operations.
- Migration is required if you have existing specs in the database; export and re-import them into Redis using the new API.
- No automatic migration is provided.

**Relevant files:**
- [`backend/services/spec_service.py`](backend/services/spec_service.py:1): Redis-based spec logic
- [`backend/auth/redis_client.py`](backend/auth/redis_client.py:1): Redis connection setup
- [`backend/routers/specs.py`](backend/routers/specs.py:1): API endpoints for specs
- [`backend/schemas.py`](backend/schemas.py:1): Spec schemas

Extending backend

- Add new routes under [`backend/routers/`](backend/routers:1) and corresponding schemas in [`backend/schemas.py`](backend/schemas.py:1).
- New validators: create modules under [`backend/validation/`](backend/validation:1) and register them where `validator.py` aggregates checks.
