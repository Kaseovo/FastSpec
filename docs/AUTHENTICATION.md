# Authentication

This document describes authentication mechanisms implemented in FastSpec and documents recent changes to API-key handling and short-lived JWTs.

Overview

- JWT-based authentication for API requests (access tokens issued at OAuth login or on sign-in).
- OAuth2 login flows for Google and GitHub (configured via environment variables).
- API keys: long-lived, hashed tokens that can be exchanged for short-lived JWTs containing scoped actions.

Recent changes (summary)

- Added API key management endpoints under the `/refresh` namespace: create, list, update actions, revoke, and exchange.
- API keys are stored hashed (plaintext returned only once at creation).
- A new short-lived JWT type (token_type="short") is introduced and used as the result of exchanging an API key. Short JWTs embed allowed actions and are time-limited.
- Access tokens (regular JWTs) are persisted as AuthToken records; tokens include a `jti` and can be revoked via the `/logout` endpoint.

Endpoints (high level)

- POST /refresh
  - Create a new API key for the authenticated user.
  - Request body: { actions: ["A","B"] }
  - Response: { api_key: "<raw_key>", id: "<id>", expires_at: "<datetime>" }

- GET /refresh
  - List active (non-expired) API keys for the authenticated user.
  - Response: array of API key metadata (id, actions, expires_at, revoked, created_at, last_used_at)

- DELETE /refresh/{id}
  - Revoke (soft-delete) an API key by id (authenticated user must own the key).

- PUT /refresh/{id}/actions
  - Update allowed actions for an API key (validates that provided actions are a subset of ALLOWED_ACTIONS).
  - Response: { message, actions }

- POST /refresh/exchange
  - Exchange a raw API key string for a short-lived JWT containing the API key's actions.
  - Request body: { api_key: "<raw_api_key>" }
  - Response: { access_token: "<short_jwt>", expires_at: "<datetime>" }
  - The API key must be unrevoked and unexpired. The server updates the API key `last_used_at` timestamp on success.

- POST /refresh/revoke
  - Revoke an API key by presenting its raw value (requires authentication with a short JWT belonging to the same user).
  - Request body: { api_key: "<raw_api_key>" }
  - Response: { message: "api_key revoked" }

- POST /logout
  - Revokes the AuthToken corresponding to the presented access JWT (uses token `jti`).

Token details

- Access tokens (regular JWTs)
  - Issued at OAuth login and via token creation helpers.
  - Include sub (user id), email, jti, iat, exp.
  - Persisted as AuthToken records when a DB session is available; can be revoked by setting `revoked = True`.

- Short JWTs
  - Created by exchanging an API key; payload contains `token_type: "short"` and an `actions` array.
  - Short JWTs are time-limited (default TTL controlled by SHORT_JWT_TTL_SECONDS).
  - Intended for performing operations that require scoped, temporary credentials (e.g., revoking an API key via the presented short token).

API key lifecycle

- Creation
  - Server generates a secure random raw key and returns it once to the caller.
  - The persisted APIKey record stores only a hash of the raw token and metadata (user_id, actions JSON, expires_at).

- Validation / Use
  - To validate a presented raw API key the server searches non-revoked, non-expired APIKey records and verifies the raw value against stored hashes.
  - On successful exchange, the server returns a short JWT and updates `last_used_at`.

- Revocation
  - Keys can be revoked by id (authenticated user) or by presenting the raw key value while authenticated with a short JWT.

Configuration / Environment variables

- JWT_SIGNING_KEY (or JWT_SECRET_KEY) — signing secret used for JWTs.
- JWT_ALGORITHM — default HS256.
- JWT_ACCESS_TOKEN_EXPIRE_MINUTES — expiry minutes for regular access tokens.
- SHORT_JWT_TTL_SECONDS — TTL (in seconds) for short JWTs returned by `/refresh/exchange` (default 300).
- API_KEY_TTL_DAYS — default lifetime for newly created API keys (default 30).
- FRONTEND_URL — used for OAuth redirects back to the frontend.
- GOOGLE_REDIRECT_URI, GITHUB_REDIRECT_URI — provider-specific redirect URIs.

Files of interest

- [`backend/auth/jwt.py`](backend/auth/jwt.py:1) — helpers for: creating/verifying access tokens, creating/verifying short JWTs, API key generation, hashing and lookup, and persistence helpers.
- [`backend/routers/auth.py`](backend/routers/auth.py:1) — HTTP routes for OAuth flows, API key management (/refresh endpoints), token exchange and logout.
- [`backend/auth/dependencies.py`](backend/auth/dependencies.py:1) — FastAPI dependency used to inject the current authenticated user into routes.
- [`frontend/src/api/auth.js`](frontend/src/api/auth.js:1) — client-side calls for auth flows (may need updates where the frontend exchanges API keys for short JWTs).
- [`frontend/src/components/TokenManager.vue`](frontend/src/components/TokenManager.vue:1) — UI for listing/creating/revoking API keys in the frontend.

Security notes

- Store JWT signing keys and OAuth secrets securely in production (Vault, cloud secret manager, or platform-provided env vars).
- API keys are sensitive: treat the returned raw key as a secret; it is shown once and not stored in plaintext on the server.
- Consider tightening ALLOWED_ACTIONS and validating intended scopes before issuing short JWTs.
- Use HTTPS in production and secure cookie options if switching from Authorization headers to cookie-based flows.

Examples

Exchange raw API key for a short JWT (example JSON request):

POST /refresh/exchange

Request:

{ "api_key": "<raw_api_key_here>" }

Success response:

{ "access_token": "<short_jwt>", "expires_at": "2026-02-02T12:50:00Z" }
