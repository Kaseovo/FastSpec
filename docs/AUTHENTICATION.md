# Authentication

How people and programs authenticate to FastSpec. For configuring sign-in
on your own instance, start with [SELF_HOSTING.md](SELF_HOSTING.md); for
the reasoning behind the design, see
[ADR-0006](adr/0006-auth-modes.md).

There are three kinds of credentials:

| Credential | Who uses it | Lifetime |
|---|---|---|
| **Session JWT** | The web app | `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (60 min) |
| **API key** | MCP clients, scripts | `API_KEY_TTL_DAYS` (30 days), revocable |
| **Short JWT** | Exchanged from an API key | `SHORT_JWT_TTL_SECONDS` (300 s) |

All are sent as `Authorization: Bearer <token>`.

## Sign-in modes

`AUTH_MODE` decides how the web app gets a session.

### `none` — single user

There is no sign-in. The first request creates one implicit local user
(`provider="local"`), and `POST /auth/local/session` returns a session JWT
for it. The web app calls that endpoint on start-up and again whenever a
request comes back 401. The endpoint returns 404 in `oidc` mode.

### `oidc` — any OpenID Connect provider

Authorization Code flow with PKCE, using full-page redirects (no popups,
so it works with popup blockers and in Brave):

1. The app sends the browser to `GET /auth/oidc/login`.
2. The backend creates a random `state`, `nonce` and PKCE verifier, stores
   them in a signed, HttpOnly, `SameSite=Lax` cookie scoped to `/auth`
   (valid 10 minutes), and redirects to the provider's authorization
   endpoint (found through `{OIDC_ISSUER}/.well-known/openid-configuration`).
3. The provider redirects back to `GET /auth/oidc/callback?code=…&state=…`
   — this is `{PUBLIC_URL}/auth/oidc/callback`, which must be registered
   with the provider.
4. The backend checks `state` against the cookie, exchanges the code (with
   the PKCE verifier) at the token endpoint, and verifies the ID token:
   signature against the provider's JWKS, `iss`, `aud`, `exp`, `iat`,
   `nonce`, and an asymmetric algorithm the provider advertises.
5. It finds or creates the user (see below) and redirects to
   `/specs/auth/callback#token=<session JWT>`, or `#error=<message>` on
   failure. The token travels in the URL fragment, so it never reaches
   server logs; the web app reads it, removes it from the address bar and
   history, and fetches `GET /auth/me`.

**Account matching.** Users are identified by provider and the provider's
stable subject (`sub`), never by email address — emails can change, and at
some providers they can be set to arbitrary values. If someone signs in
with an email that already belongs to a *different* subject, sign-in is
refused rather than linked. Google accounts created before the move to
generic OIDC keep working: they were stored under `provider="google"` with
the same subject.

**Who can sign in.** A token with `email_verified: false` is always
rejected. With `ALLOWED_EMAILS` / `ALLOWED_EMAIL_DOMAINS` set, only
verified addresses on the list get in.

**Configuration safety.** The server refuses to start on contradictory
settings (OIDC settings while `AUTH_MODE=none`, an allowlist in `none` mode,
or `oidc` with a missing setting), so a misconfiguration can't leave it
open.

`GET /auth/config` (public) tells the app which mode is active:

```json
{ "mode": "oidc", "provider_name": "Google", "login_url": "/auth/oidc/login" }
```

## Sessions

Session JWTs carry `sub` (user id), `email`, `jti`, `iat` and `exp`, signed
with `JWT_SECRET_KEY` (generated and stored in `FASTSPEC_DATA_DIR` when not
set). Each one is recorded by `jti` in the `auth_tokens` table (the token
itself is never stored); `POST /auth/logout` revokes it.

## API keys

Long-lived keys for MCP clients and scripts, managed in the app (key icon,
**API keys**) or through the API:

| Endpoint | Purpose |
|---|---|
| `POST /auth/api-keys` | Create a key: `{ "actions": ["All"], "name": "laptop" }`. The raw key is in the response **once**. |
| `GET /auth/api-keys` | List your unexpired keys. |
| `PUT /auth/api-keys/{id}/actions` | Change a key's actions and name. |
| `DELETE /auth/api-keys/{id}` | Revoke a key. |
| `POST /auth/api-keys/exchange` | Trade `{ "api_key": "…" }` for a short JWT carrying the key's actions. |
| `POST /auth/api-keys/revoke` | Revoke a key by its raw value. |
| `GET /auth/actions` | List the actions a key can be granted. |

Keys are stored hashed; only a short, non-secret prefix is kept in clear
for lookup. Each key carries a set of **actions** (`read:specs`,
`write:specs`, `lint:specs`, … or `All`) that bound what it can do.

The MCP server (`/mcp`) accepts either a raw API key or a short JWT from
`/auth/api-keys/exchange`. Sending the short JWT on subsequent calls avoids
re-verifying the key's hash every time; the key's revocation status is
still checked.

## Rate limits

Sign-in callbacks (20/min) and API-key exchanges (30/min) are rate limited
per client IP. Behind a reverse proxy, set `FORWARDED_ALLOW_IPS` so the real
client address is used.

## Code map

- `backend/config.py` — settings and the start-up configuration checks.
- `backend/routers/auth.py` — sign-in, session and API-key endpoints.
- `backend/auth/oidc.py` — OIDC discovery, PKCE, token exchange, ID-token
  verification.
- `backend/auth/users.py` — local user, OIDC account matching, allowlist,
  and the `transfer-local-data` hand-over.
- `backend/auth/jwt.py` — session JWTs, API keys, short JWTs.
- `backend/auth/dependencies.py` — `get_current_user` for routes.
- `frontend/src/auth/session.js` — start-up: sign-in callback, auth mode,
  single-user session.
- `frontend/src/api/http.js` — attaches the session and handles 401s.
