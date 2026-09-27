# Self-hosting FastSpec

FastSpec ships as one Docker image that serves the web app, the API and the
MCP server on port 8080. It needs no configuration to start.

- [Quickstart (single user, SQLite)](#quickstart-single-user-sqlite)
- [With Postgres (teams)](#with-postgres-teams)
- [Sign-in with your identity provider](#sign-in-with-your-identity-provider)
- [Putting it on a network](#putting-it-on-a-network)
- [Connecting AI agents (MCP)](#connecting-ai-agents-mcp)
- [Backups and upgrades](#backups-and-upgrades)
- [Configuration reference](#configuration-reference)

## Quickstart (single user, SQLite)

```bash
docker run -d --name fastspec \
  -p 127.0.0.1:8080:8080 \
  -v fastspec-data:/data \
  ghcr.io/kaseovo/fastspec:latest
```

Open <http://localhost:8080>. There is no sign-in: FastSpec runs in
single-user mode, keeps its SQLite database and a generated secret in the
`fastspec-data` volume, and only listens on your own machine.

> **Single-user mode has no sign-in at all.** Anyone who can reach the port
> has full access. Keep it bound to `127.0.0.1` (as above) or a trusted
> network, or configure [sign-in](#sign-in-with-your-identity-provider).

To build the image yourself instead: `docker build -t fastspec .` from a
clone of the repository, then use `fastspec` as the image name.

## With Postgres (teams)

```bash
git clone https://github.com/Kaseovo/FastSpec.git && cd FastSpec
cp .env.example .env        # optional: sign-in, public URL, …
docker compose up -d
```

`docker-compose.yml` runs FastSpec plus Postgres 16, and also listens on
`127.0.0.1:8080` only. Set `POSTGRES_PASSWORD` in `.env` before the first
start if you want something other than the default (the database isn't
exposed outside the compose network either way).

SQLite is fine for one person or a small team. Use Postgres when several
people edit at once, or when you already back up and monitor Postgres.

## Sign-in with your identity provider

Set `AUTH_MODE=oidc` and point FastSpec at any OpenID Connect provider. The
same settings work for Google, Keycloak, Authentik, Okta, Microsoft Entra,
GitLab and others.

```env
PUBLIC_URL=https://fastspec.example.com
AUTH_MODE=oidc
OIDC_ISSUER=https://idp.example.com/realms/acme
OIDC_CLIENT_ID=fastspec
OIDC_CLIENT_SECRET=…
OIDC_PROVIDER_NAME=Acme SSO          # button label, optional
ALLOWED_EMAIL_DOMAINS=example.com    # optional, see below
```

In your provider, create a *confidential* web client (Authorization Code
flow) with this redirect URI:

```
{PUBLIC_URL}/auth/oidc/callback
```

FastSpec requests the `openid email profile` scopes and uses PKCE.

| Provider | `OIDC_ISSUER` | Notes |
|---|---|---|
| Google | `https://accounts.google.com` | Create an OAuth client ID of type *Web application* in Google Cloud Console. |
| Keycloak | `https://<host>/realms/<realm>` | Client authentication *On*, standard flow enabled. |
| Authentik | `https://<host>/application/o/<app-slug>/` | OAuth2/OpenID provider, confidential client. |
| GitLab | `https://gitlab.com` (or your instance) | Application with scopes `openid email profile`. |
| Microsoft Entra | `https://login.microsoftonline.com/<tenant-id>/v2.0` | Single-tenant app registration, web platform. |
| Okta | `https://<org>.okta.com` (or an authorization server URL) | Web app integration. |

**Who can sign in.** Without an allowlist, any account at the provider can
sign in. For Google, that means *any Google account in the world*. Restrict
it with `ALLOWED_EMAIL_DOMAINS` and/or `ALLOWED_EMAILS` (comma-separated).
The allowlist only accepts emails the provider marks as verified.

**Safety net.** FastSpec refuses to start if OIDC settings are present while
`AUTH_MODE` is `none`, or if `AUTH_MODE=oidc` is missing a setting, so a
typo can't silently leave the server open.

**Moving from single-user mode.** Specs created in single-user mode belong
to a local user. After switching to OIDC, sign in once, then move them to
your account:

```bash
docker exec fastspec python cli.py transfer-local-data --to you@example.com
```

See [AUTHENTICATION.md](AUTHENTICATION.md) for how sign-in and API keys work
in detail.

## Putting it on a network

Expose FastSpec through a reverse proxy that terminates TLS, and set
`PUBLIC_URL` to the address people use. For example, with
[Caddy](https://caddyserver.com):

```
fastspec.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

- `PUBLIC_URL=https://fastspec.example.com` — used for the sign-in redirect
  URI and to mark cookies `Secure`.
- `FORWARDED_ALLOW_IPS` — the proxy's IP when it isn't on the same host, so
  rate limiting sees real client addresses.
- Serve FastSpec at the root of a (sub)domain; it can't live under a path
  prefix.
- Use `AUTH_MODE=oidc` for anything reachable by more than you.

## Connecting AI agents (MCP)

FastSpec includes an [MCP](https://modelcontextprotocol.io) server so AI
agents can read, write, version, lint and compare your specs. In the app, click the key icon (**API keys**),
create a key, and copy the MCP URL shown there — `{PUBLIC_URL}/mcp`.

Claude Code:

```bash
claude mcp add --transport http fastspec http://localhost:8080/mcp \
  --header "Authorization: Bearer <your API key>"
```

Other clients: configure a *streamable HTTP* MCP server with that URL and an
`Authorization: Bearer <API key>` header. API keys are needed in every
mode, including single-user.

The tools an agent sees depend on the actions granted to its API key:

| Tool | What it does | Action |
|---|---|---|
| `get_saved_specs_for_user`, `get_spec_details` | List specs; read a spec's current document | `read:specs` |
| `validate_spec` | Check that a document is valid OpenAPI 3 | `read:specs` |
| `create_spec` | Create a spec from a document (object or YAML/JSON text) | `write:specs` |
| `delete_spec` | Delete a spec and its versions | `delete:specs` |
| `list_spec_versions`, `get_spec_version` | Browse versions | `read:versions` |
| `compare_spec_versions` | Markdown diff between versions, or against an unsaved document | `read:versions` |
| `save_spec_version` | Save a document as a new version (replacing one only with `overwrite: true`) | `write:versions` |
| `lint_spec` | Lint a stored version or an unsaved document with the user's rulesets | `lint:specs` |

Give an agent only what it needs — for example, `read:specs` and
`lint:specs` for a reviewer.

## Backups and upgrades

**Upgrading**: pull the new image and recreate the container. Database
migrations run automatically at start-up.

```bash
docker pull ghcr.io/kaseovo/fastspec:latest
docker rm -f fastspec && docker run -d --name fastspec … # same flags as before
# or, with compose:
docker compose pull && docker compose up -d
```

**Backing up SQLite** (safe while running):

```bash
docker exec fastspec python -c "import sqlite3; sqlite3.connect('/data/fastspec.db').backup(sqlite3.connect('/data/backup.db'))"
docker cp fastspec:/data/backup.db ./fastspec-backup.db
```

**Backing up Postgres**:

```bash
docker compose exec postgres pg_dump -U fastspec fastspec > fastspec-backup.sql
```

Also keep `/data/jwt_secret` (or your own `JWT_SECRET_KEY`): without it,
existing sessions and API keys stop working. People can sign in again and
create new keys, but no data is lost.

## Configuration reference

All settings are environment variables (or lines in `.env` for compose).
Everything is optional in single-user mode.

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_URL` | `http://localhost:8080` | Address people use; builds the sign-in redirect URI. |
| `AUTH_MODE` | `none` | `none` (single user, no sign-in) or `oidc`. |
| `OIDC_ISSUER` | — | Provider issuer URL (`oidc` mode). |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | — | Client credentials (`oidc` mode). |
| `OIDC_PROVIDER_NAME` | `Google` or `SSO` | Sign-in button label. |
| `OIDC_SCOPES` | `openid email profile` | Requested scopes. |
| `ALLOWED_EMAIL_DOMAINS` / `ALLOWED_EMAILS` | — | Optional sign-in allowlist (`oidc` mode). |
| `DATABASE_URL` | SQLite in the data dir | e.g. `postgresql://user:pass@host:5432/fastspec`. |
| `FASTSPEC_DATA_DIR` | `/data` in the image | SQLite database and generated JWT secret. |
| `JWT_SECRET_KEY` | generated | Set explicitly when running several instances. |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Browser session lifetime. |
| `API_KEY_TTL_DAYS` | `30` | Lifetime of new API keys. |
| `PORT` | `8080` | Listening port inside the container. |
| `WEB_CONCURRENCY` | `1` | Worker processes. |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Proxies trusted for `X-Forwarded-*`. |
| `CORS_ORIGINS` | `PUBLIC_URL` | Only needed if another origin calls the API. |
| `SOURCE_URL` | this project's repository | "Source code" link in the app. If you run a **modified** FastSpec for others, the AGPL requires offering them your source — point this at it. |

`.env.example` in the repository lists the same settings with comments.
