# Architecture

This document describes the high-level architecture of FastSpec and how the frontend, backend and supporting services interact.

1. System components

- Frontend (SPA) — located in [`frontend`](frontend) and built with Vue 3 + Vite. It provides the editor UI, preview, diff drawer and authentication UX.
- Backend (API) — located in [`backend`](backend), implemented with FastAPI. It exposes authentication, spec CRUD and validation endpoints and contains core business logic (auth, validation, diffing).
- MCP servers — optional model/context protocol servers located under [`backend/mcp`](backend/mcp:1) (example implementation: [`backend/mcp/server.py`](backend/mcp/server.py:1)). MCP servers can expose tools and resources to the agent and run as separate processes or services.
- Data storage — configured via [`backend/database.py`](backend/database.py:1). The project is DB-agnostic and can use SQLite for development or Postgres in production.
- Containers — `frontend/Dockerfile` and `backend/Dockerfile` define service images; `docker-compose.yml` orchestrates them for local development.

2. Interaction and data flow

- Authentication: the frontend initiates login flows (credentials or OAuth), exchanges tokens with backend endpoints in [`backend/routers/auth.py`](backend/routers/auth.py:1), and stores short-lived access tokens client-side.
- Spec management: the frontend calls the specs API (`backend/routers/specs.py`) to list, create, update and delete spec resources. Schemas are defined in [`backend/schemas.py`](backend/schemas.py:1).
- Validation & diff: the backend exposes validation and diff capabilities using utilities in `backend/validation/` (see `validator.py` and `diff_utils.py`). The frontend calls these endpoints to present results in the UI.
- MCP integration: MCP servers may call backend auth endpoints to obtain short-lived credentials and may use JWTs to authenticate requests from clients. See section 7 for details.

3. Backend responsibilities

- Authenticate requests and enforce permissions (JWT tokens, OAuth helpers in [`backend/auth/`](backend/auth:1)).
- Persist spec metadata and content via [`backend/models.py`](backend/models.py:1) and [`backend/database.py`](backend/database.py:1).
- Validate spec content and compute diffs using the validation utilities.

4. Frontend responsibilities

- Provide a responsive editor with preview and diff tooling.
- Handle authentication flows and token lifecycle.
- Convert editor state to API requests and render validation/diff responses.

5. Deployment considerations

- The backend is stateless: scale any number of backend instances behind a load balancer.
- Use a managed relational database for production and configure secure storage of secrets (avoid storing tokens in localStorage in production; prefer httpOnly cookies or secure client-side stores).
- Serve frontend static assets from a CDN or a static asset service for production.

6. Extensibility

- Validation rules and diff strategies are modular under `backend/validation/` and can be extended with new validators or output formats.
- Additional auth providers can be added by extending [`backend/auth/oauth.py`](backend/auth/oauth.py:1) and wiring new routes in [`backend/routers/auth.py`](backend/routers/auth.py:1).

7. MCP (Model Context Protocol) integration

- Purpose: MCP servers expose specialized tools and resources (e.g., external APIs, data connectors) to the agent. They run as separate processes or services and communicate via the MCP protocol (stdio/http/SSE).

- Example server: See the example implementation in [`backend/mcp/server.py`](backend/mcp/server.py:1). This example demonstrates:
  - Using `FastMCP` to declare tools (`@mcp.tool`) such as `greet` and `who_am_i`.
  - A synchronous token verifier (`JWTVerifier`) which validates incoming JWTs from clients.
  - A helper `get_short_jwt()` that can obtain a short-lived JWT from the auth service and cache it until expiry. The helper expects the environment variables `AUTH_SERVICE_URL` and `MCP_REFRESH_TOKEN` to be set.

- Configuration and environment variables (example):
  - `JWT_SIGNING_KEY` / `JWT_SECRET_KEY` — shared signing secret used for JWT verification.
  - `JWT_ALGORITHM` — signing algorithm (default HS256).
  - `AUTH_SERVICE_URL` — base URL of the backend authentication service (used by MCP helpers to call token exchange endpoints).
  - `MCP_REFRESH_TOKEN` — a stored refresh token or secret used by the MCP server to obtain short-lived JWTs from the auth service.

- How MCP authentication works in this project:
  - Clients calling MCP-exposed tools should include a Bearer JWT in the Authorization header; the `JWTVerifier` in the MCP server verifies the token synchronously.
  - When the MCP server needs to call the backend on its own (for example, to exchange a stored long-lived secret for a short JWT used to call other services), it uses `get_short_jwt()` to POST to the auth service and caches the result until expiry.

- Integration caveats and expectations:
  - The example MCP helper posts to an auth exchange endpoint at `AUTH_SERVICE_URL` (see [`backend/mcp/server.py`](backend/mcp/server.py:1)). Ensure your auth service exposes an appropriate exchange endpoint that accepts the configured secret/refresh token and returns `{ "access_token": "...", "expires_at": "..." }`.
  - The project also supports exchanging API keys for short JWTs via [`backend/routers/auth.py`](backend/routers/auth.py:1) under `/auth/refresh/exchange` (exchanging a raw API key). If you expect the MCP server to use a different exchange flow (e.g., refresh-token-based), ensure the backend exposes the matching endpoint or adapt `get_short_jwt()` accordingly.

- Running MCP servers:
  - MCP servers can be run as standalone processes (see `mcp.run(...)` in the example). They may use `stdio` transport for local development or `http`/SSE transports for remote servers.
  - When deploying, provide necessary environment variables to the MCP process (auth secrets, API keys, service URLs). Treat these values as sensitive.

- Files of interest:
  - [`backend/mcp/server.py`](backend/mcp/server.py:1) — example MCP server implementation and helpers.
  - [`backend/routers/auth.py`](backend/routers/auth.py:1) — auth endpoints used for token creation/exchange/revocation.
  - [`backend/auth/jwt.py`](backend/auth/jwt.py:1) — JWT helpers used across the system.
