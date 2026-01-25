# FastSpec — Project Overview

Purpose

- FastSpec is a web application for creating, editing, previewing and validating specification documents (API specs, Markdown-based docs) with collaborative-friendly features such as diffs, previews and user authentication.

Key features

- In-browser editor with preview and diff tooling.
- Backend validation and diff utilities for spec comparison.
- JWT + OAuth authentication supporting session and third-party logins.
- REST API for spec CRUD and validation operations.
- Docker-ready setup for local development and deployment.

Target users

- API engineers and technical writers who maintain spec documents and need fast iteration and validation.

Tech stack

- Frontend: Vue 3 (Vite), single-page application under `frontend/`.
- Backend: Python FastAPI app under `backend/` (REST API, auth, validation utilities).
- Persistence: lightweight DB layer (see `backend/database.py`) — suitable for SQLite / Postgres depending on configuration.
- Containers: Dockerfiles for frontend and backend and `docker-compose.yml` for orchestrated local environment.

Repository layout

- [`frontend`](frontend): Vue SPA source, components, API client wrappers.
- [`backend`](backend): FastAPI app, routers, auth, validation and models/schemas.
- [`docs`](docs): documentation (this directory).
- [`plans`](plans): migration and implementation notes.

Where to start

1. Read the high-level architecture in `docs/ARCHITECTURE.md`.
2. Read the backend and frontend implementation guides in `docs/BACKEND.md` and `docs/FRONTEND.md`.
3. Use `docker-compose.yml` to run a complete local instance (see `docs/DEPLOYMENT.md`).
