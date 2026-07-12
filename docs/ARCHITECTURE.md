# Architecture

This document describes the high-level architecture of FastSpec and how the frontend, backend and supporting services interact.

1. System components

- Frontend (SPA) — located in [`frontend`](frontend) and built with Vue 3 + Vite + PrimeVue + Monaco. It provides the editor UI, preview, diff drawer and authentication UX.
- Backend (API) — located in [`backend`](backend), implemented with FastAPI + SQLAlchemy + Alembic. It exposes authentication, spec CRUD/versioning, lint and validation endpoints, and contains core business logic (auth, validation, diffing, linting).
- MCP server — mounted into the same ASGI app as the FastAPI backend (not a separate process). See [`backend/fastmcp_server/server.py`](backend/fastmcp_server/server.py:1), built with FastMCP and mounted at `/mcp` in [`backend/app.py`](backend/app.py:1). It exposes read-only spec tools to AI agents, authenticated via short-lived JWTs (see section 7).
- Data storage — Specs, versions, users, API keys and auth tokens are persisted in PostgreSQL via SQLAlchemy models in [`backend/models.py`](backend/models.py:1), with schema managed by Alembic migrations under `backend/alembic/versions/`. There is no Redis in this system.
- Deployment — the backend runs as a Docker-image AWS Lambda behind a Function URL (via Mangum, see [`backend/lambda_handler.py`](backend/lambda_handler.py:1)); the frontend SPA is served from S3/CloudFront. Infrastructure is defined with CDK under [`infra/`](infra). A Wake/AutoStop stack starts and stops the RDS instance on demand to save cost — see the ADRs under `docs/adr/` for the rationale.

2. Interaction and data flow

- Authentication: the frontend initiates Google sign-in (server-side OAuth 2.0 Authorization Code redirect flow), exchanges tokens with backend endpoints in [`backend/routers/auth.py`](backend/routers/auth.py:1), and stores the resulting FastSpec JWT client-side. See [`docs/AUTHENTICATION.md`](AUTHENTICATION.md) for the full flow.
- Spec management: the frontend calls the specs API (`backend/routers/specs.py`) to list, create, update, delete and version spec resources. Schemas are defined in [`backend/schemas.py`](backend/schemas.py:1).
- Linting: the frontend calls `backend/routers/lint.py`, which delegates to `LintService` and the `SpectralClient` seam (subprocess or HTTP sidecar) in `backend/validation/spectral_client.py` to run Stoplight Spectral.
- Validation & diff: the backend exposes validation and diff capabilities using utilities in `backend/validation/` (see `validator.py` and `diff_utils.py`). The frontend calls these endpoints to present results in the UI.
- MCP integration: MCP clients (AI agents) authenticate with a short-lived JWT (obtained by exchanging an API key via `/auth/api-keys/exchange`) and call read-only spec tools exposed by the mounted MCP server. See section 7 for details.

3. Backend responsibilities

- Authenticate requests and enforce permissions (JWT tokens, Google OAuth in [`backend/routers/auth.py`](backend/routers/auth.py:1) and [`backend/auth/`](backend/auth:1)).
- Persist spec metadata and content via [`backend/models.py`](backend/models.py:1) and [`backend/database.py`](backend/database.py:1).
- Validate spec content, compute diffs, and run lint using the validation utilities and lint services.

4. Frontend responsibilities

- Provide a responsive editor with preview and diff tooling.
- Handle authentication flows and token lifecycle.
- Convert editor state to API requests and render validation/diff/lint responses.

5. Deployment considerations

- The backend runs as a single Lambda function per environment (see `infra/lib/*.ts`); there is no separate application server or load balancer.
- PostgreSQL (RDS) is the system of record; see the Wake/AutoStop ADR for how it's started/stopped to control cost, and `docs/CODE_REVIEW.md` for open security considerations around its network exposure.
- Serve frontend static assets from S3/CloudFront.

6. Extensibility

- Validation rules and diff strategies are modular under `backend/validation/` and can be extended with new validators or output formats.
- Additional OAuth providers can be added by extending [`backend/routers/auth.py`](backend/routers/auth.py:1) and the `User.provider` field in [`backend/models.py`](backend/models.py:1).

7. MCP (Model Context Protocol) integration

- Purpose: the MCP server exposes read-only spec tools (e.g., `get_saved_specs_for_user`, `get_spec_details`, `who_am_i`) so AI agents can read a user's OpenAPI specs. It is mounted into the same FastAPI ASGI app rather than running as a separate process.

- Implementation: see [`backend/fastmcp_server/server.py`](backend/fastmcp_server/server.py:1) (tool definitions), [`backend/fastmcp_server/authentication.py`](backend/fastmcp_server/authentication.py:1) (short-JWT validation and the `get_current_user` dependency for tools), and [`backend/fastmcp_server/middleware.py`](backend/fastmcp_server/middleware.py:1) (per-request auth + per-tool action-based authorization, plus request/response logging).

- How MCP authentication works in this project:
  - A client first calls `POST /auth/api-keys/exchange` with a raw API key to obtain a short-lived JWT (`token_type: "short"`) carrying the API key's allowed actions.
  - MCP requests carry that short JWT as a Bearer token. `AuthenticationMiddleware` validates it per-request and filters/authorizes tools based on each tool's declared `actions` metadata versus the token's actions.
  - There is no separate `MCP_REFRESH_TOKEN` or long-lived secret for the MCP server itself — it relies entirely on the short JWT presented by the calling client.

- Running the MCP server: it is not run standalone. It is mounted at `/mcp` on the main FastAPI app in [`backend/app.py`](backend/app.py:1) and served together with the rest of the API (locally via uvicorn, in production via the same Lambda Function URL).

- Files of interest:
  - [`backend/fastmcp_server/server.py`](backend/fastmcp_server/server.py:1) — MCP tool definitions.
  - [`backend/fastmcp_server/authentication.py`](backend/fastmcp_server/authentication.py:1) / [`backend/fastmcp_server/middleware.py`](backend/fastmcp_server/middleware.py:1) — short-JWT auth and per-tool authorization.
  - [`backend/routers/auth.py`](backend/routers/auth.py:1) — auth endpoints used for API key creation/exchange/revocation.
  - [`backend/auth/jwt.py`](backend/auth/jwt.py:1) — JWT helpers used across the system.
