# Changelog

Notable changes to FastSpec. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and FastSpec uses
[Semantic Versioning](https://semver.org) (see
[docs/RELEASING.md](docs/RELEASING.md)).

## [Unreleased]

### Added

- AWS deployment: the domain's DNS can stay at another provider
  (`FASTSPEC_EXTERNAL_DNS=true`, e.g. Cloudflare) instead of a Route 53
  hosted zone.

### Changed

- **The AWS deployment's database is a serverless Postgres** (Neon for the
  hosted version) instead of RDS, given as a connection string in SSM
  (`/<env>/fastspec/database-url`). It costs nothing while idle and resumes
  on the first connection in under a second, so nothing needs waking up —
  an idle month costs cents instead of about $17 (ADR-0009).
- Database errors answer `503` (`"code": "database_unavailable"`) instead of
  `500`, and Postgres connections time out after 10 seconds instead of
  hanging.

### Fixed

- Signing in while the database was unreachable ended on an "Internal
  Server Error" page; it now returns to the app with a message.

### Removed

- AWS deployment: the RDS database stack, the wake page and its wake and
  auto-stop Lambdas, and the manual "Prod Environment" start/stop workflow
  (which had stopped working: the deploy role may not look up RDS
  instances).

## [0.1.0] - 2026-09-27

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
- **YAML editing**: the code editor switches between YAML and JSON (YAML by
  default). Lint markers follow each finding's path, so they're right in
  both formats; syntax errors block saving instead of silently saving older
  content.
- **Import and download**: open an OpenAPI 3.0/3.1 file (YAML or JSON) by
  dropping, choosing or pasting it; download what's in the editor as YAML
  or JSON.
- **Example spec**: a complete Petstore API to start from, offered on the
  first visit.
- **MCP tools** to create, delete, version, validate, lint and compare
  specs, each gated by the API key's actions.
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
- Swagger UI is bundled with the app instead of loaded from a CDN, so the
  preview works offline.
- A missing Spectral CLI is reported as a lint error with install
  instructions instead of a server error.
- Licensed under the AGPL-3.0.

### Fixed

- Version comparisons showed changes backwards (added endpoints appeared
  as removed).
- The MCP server failed on every request.
- Jumping to a lint finding lost the current spec from the URL; switching
  specs kept showing the previous spec's lint score.
- Logging out didn't revoke the session on the server.
- Postgres connections would have broken on a fresh install (SQLAlchemy 2.1
  expects psycopg 3).
- Migrations failed on SQLite, and some server defaults were invalid there.
- Deploying the AWS setup from scratch needed generated database passwords
  copied into SSM by hand; the Lambda now reads them from Secrets Manager.

### Removed

- `POST /auth/google/verify` and the Google-specific sign-in routes.
- The Traefik-based compose files and the separate MCP container.
