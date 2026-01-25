# Deployment and Local Setup

This document explains how to run FastSpec locally with Docker and how to set environment variables for basic operation.

Prerequisites

- Docker and Docker Compose installed.
- (Optional) Python and Node.js if running services without containers.

Local using Docker Compose

1. Copy `.env.example` to `.env` and update values (secrets, DB url, OAuth keys).
2. Run: docker compose up --build
   - This will build `frontend` and `backend` images and start services.
3. Visit frontend at http://localhost:5173 (Vite dev server default) or configured port.

Running backend locally without Docker

1. Create and activate a Python virtualenv.
2. pip install -r backend/requirements.txt
3. uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

Running frontend locally without Docker

1. cd frontend
2. npm install
3. npm run dev

Configuration

- Environment variables are read by the backend to configure DB connections and auth secrets. See `.env.example` for required variables.
- OAuth providers: provide client ID/secret and callback URL matching `frontend` OAuth callback route.

Production notes

- Build frontend for production and serve static assets via CDN or a static webserver.
- Use a production-grade database and secure secrets management (Vault, environment variables in cloud providers).
- Use HTTPS with proper certificate management.
