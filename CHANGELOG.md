# Changelog

Notable changes to FastSpec. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and FastSpec uses
[Semantic Versioning](https://semver.org) (see
[docs/RELEASING.md](docs/RELEASING.md)).

## [Unreleased]

The first open-source release.

### Added

- **Self-hosting**: a single Docker image serving the web app, API and MCP
  server on one port, published for `linux/amd64` and `linux/arm64`. Starts
  with no configuration; migrations run automatically.
- **Single-user mode** (`AUTH_MODE=none`, the default): no sign-in.
- **Sign-in with any OpenID Connect provider** (`AUTH_MODE=oidc`): Google,
  Keycloak, Authentik, Okta, Microsoft Entra, GitLab… with an optional
  email or domain allowlist. The server refuses to start on contradictory
  settings.
- **SQLite support** alongside Postgres, and `docker-compose.yml` for a
  Postgres setup.
- `python cli.py transfer-local-data` to move single-user data to a
  signed-in account.
- "Source code" link in the app, configurable with `SOURCE_URL`.
- Docs: self-hosting guide, authentication, deployment, releasing,
  contributing, security policy.

### Changed

- The MCP endpoint is `/mcp` (it was `/mcp/mcp`) and runs stateless.
- A missing or invalid session now returns `401 Unauthorized` (was `403`).
- Google sign-in uses the generic OIDC flow; its redirect URI is now
  `/auth/oidc/callback`.
- "Manage Tokens" is now called "API keys".
- Upgraded FastAPI (0.141), Starlette (1.7) and FastMCP (3.4.7, from a
  3.0 beta); backend dependencies are pinned in `requirements*.txt`.
- Licensed under the AGPL-3.0.

### Fixed

- The MCP server failed on every request.
- Logging out didn't revoke the session on the server.
- Postgres connections would have broken on a fresh install (SQLAlchemy 2.1
  expects psycopg 3).
- Migrations failed on SQLite, and some server defaults were invalid there.

### Removed

- `POST /auth/google/verify` and the Google-specific sign-in routes.
- The Traefik-based compose files and the separate MCP container.
