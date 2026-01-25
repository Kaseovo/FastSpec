# Backend Implementation

Location: `backend/`

Overview

- Backend is a FastAPI application that exposes auth and spec-related endpoints.
- Main entrypoint: `backend/main.py` which sets up the FastAPI app and mounts routers.

Key files

- `backend/main.py` — app instantiation and router registration.
- `backend/models.py` — ORM models or DB-layer structures used to persist specs and users.
- `backend/schemas.py` — Pydantic models for request/response validation.
- `backend/database.py` — database connection and session management.
- `backend/auth/` — authentication helpers: `jwt.py`, `oauth.py`, and `dependencies.py`.
- `backend/routers/` — `auth.py` and `specs.py` routers defining HTTP endpoints.
- `backend/validation/` — `validator.py` and `diff_utils.py` that implement validation rules and diff logic.

Run locally (development)

- Install dependencies from `backend/requirements.txt`.
- Start dev server: uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

Authentication

- JWT handling: token creation/verification in `backend/auth/jwt.py`.
- Dependency injection: `backend/auth/dependencies.py` defines `get_current_user` and other helpers used by routers.
- OAuth: flows implemented in `backend/auth/oauth.py`, which interacts with upstream OAuth providers.

Validation and diff

- `backend/validation/validator.py` exposes validation functions that run a set of rules against spec content and return structured findings.
- `backend/validation/diff_utils.py` computes structured diffs between spec versions or arbitrary payloads. The frontend displays diffs using a `DiffDrawer` component.

Database

- See `backend/database.py` for connection setup and usage. Switch DB by updating configuration and environment variables.

Extending backend

- Add new routes under `backend/routers/` and corresponding schemas in `backend/schemas.py`.
- New validators: create modules under `backend/validation/` and register them where `validator.py` aggregates checks.
