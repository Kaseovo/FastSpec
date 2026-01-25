# Architecture

This document describes the high-level architecture of FastSpec and how the frontend, backend and supporting services interact.

1. System components

- Frontend (SPA) — located in [`frontend`](frontend) and built with Vue 3 + Vite. It provides the editor UI, preview, diff drawer and authentication UX.
- Backend (API) — located in [`backend`](backend), implemented with FastAPI. It exposes authentication, spec CRUD and validation endpoints and contains core business logic (auth, validation, diffing).
- Data storage — configured via `backend/database.py`. The project is DB-agnostic and can use SQLite for development or Postgres in production.
- Containers — `frontend/Dockerfile` and `backend/Dockerfile` define service images; `docker-compose.yml` orchestrates them for local development.

2. Interaction and data flow

- Authentication: the frontend initiates login flows (credentials or OAuth), exchanges tokens with backend endpoints in `backend/routers/auth.py`, and stores short-lived access tokens client-side.
- Spec management: the frontend calls the specs API (`backend/routers/specs.py`) to list, create, update and delete spec resources. Schemas are defined in `backend/schemas.py`.
- Validation & diff: the backend exposes validation and diff capabilities using utilities in `backend/validation/` (see `validator.py` and `diff_utils.py`). The frontend calls these endpoints to present results in the UI.

3. Backend responsibilities

- Authenticate requests and enforce permissions (JWT tokens, OAuth helpers in `backend/auth/`).
- Persist spec metadata and content via `backend/models.py` and `backend/database.py`.
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
- Additional auth providers can be added by extending `backend/auth/oauth.py` and wiring new routes in `backend/routers/auth.py`.
