# Authentication

This document describes authentication mechanisms implemented in FastSpec.

Mechanisms

- JWT-based authentication for API requests.
- OAuth2 login flows for Google and GitHub (configured via environment variables).

Files of interest

- `backend/auth/jwt.py` — token creation and verification helpers.
- `backend/auth/oauth.py` — OAuth helper functions and provider configuration.
- `backend/auth/dependencies.py` — FastAPI dependency helpers for injecting authenticated user into routes.
- `frontend/src/api/auth.js` — client-side API calls for auth flows.
- `frontend/src/components/OAuthCallback.vue` — handles the OAuth redirect callback and token handling.

Setup

1. Add OAuth client IDs and secrets to `.env` as shown in `README.md`.
2. Ensure redirect URIs match the frontend callback path (e.g., `http://localhost:3000/auth/callback`).
3. Start backend and frontend.

Security notes

- Use secure storage for JWT secrets in production (Vault or environment variables provided by the hosting platform).
- Configure HTTPS and secure cookie options if switching to cookie-based token storage.
