# FastSpec — Open-Source Release Roadmap

Living plan for making FastSpec public and easy to self-host. Tick items off
as they land; move anything that slips into the backlog at the bottom.

## Decisions (2026-09-26)

| # | Topic | Decision | Why |
|---|---|---|---|
| 1 | Hosted version | Keep running `fastspec.kaseovo.com` alongside the open-source release, for now. May shut it down later (pure OSS). | Near-zero idle cost; easier to stop later than to restart. Hosting-specific code is kept isolated so dropping it later is mostly deletion. |
| 2 | License | **AGPL-3.0**. Relicense to MIT if the hosted version is shut down. | Protects the hosted version from closed hosted forks while it exists; relaxing a license later is easy, tightening it is not. No CLA — ask contributors directly if relicensing. |
| 3 | Auth | `AUTH_MODE=none` (single user, no login) or `AUTH_MODE=oidc` (any OIDC provider, incl. Google). Optional email/domain allowlist. The server refuses to start on contradictory config — never silently falls back to `none`. | Self-hosters shouldn't need a Google Cloud project to try it; OIDC covers teams (Keycloak, Authentik, Okta, Entra, GitLab, Google) with one code path. |
| 4 | Database | SQLite (single-container quickstart) **and** Postgres (compose / teams / hosted). CI tests both. | One-line `docker run` install; Postgres stays for anything multi-user. |
| 5 | Git history | Keep history; scrub AWS account ID, hosted-zone ID, certificate ARN and rewrite author email to the GitHub no-reply address with `git filter-repo` on a fresh clone, right before publishing. | Keeps the project's history and blame; removes the few identifying details while it's still cheap. |
| 6 | v0.1 feature scope | YAML editing, import (file/paste), export (JSON/YAML), bundled Swagger UI, "start from example" spec, MCP write tools. | Passes the "I pasted my real spec and it worked" test and shows off the MCP angle. |
| 7 | Hosting-specific pieces | The app, CDK infra and deploy workflow stay public, driven by GitHub repository variables (domain, hosted zone, region). The landing page (Webstudio export + Kaseovo legal pages) moves, with its history, to a private `fastspec-website` repo with its own deploy workflow. | Keeps the serverless setup as a working reference and app + infra changes in one PR; the only generated, Kaseovo-specific part leaves. |
| 8 | Code of Conduct contact | Contributor Covenant 2.1, reports to a dedicated `conduct@kaseovo.com` alias. Security reports go through GitHub's private vulnerability reporting. | Keeps personal email private and can be handed to someone else later; GitHub has no private channel for conduct reports. |

## Phases

### Phase 1 — Runnable locally ✅
- [x] Single Docker image: API + built SPA + MCP on one port, Spectral bundled ([ADR-0008](adr/0008-single-image-self-hosting.md))
- [x] `AUTH_MODE=none|oidc`, allowlist, startup config validation ([ADR-0006](adr/0006-auth-modes.md))
- [x] SQLite support (migrations portable, Postgres-only migration guarded) ([ADR-0007](adr/0007-sqlite-and-postgres.md))
- [x] Migrations run automatically on container start; JWT secret auto-generated and persisted when not provided
- [x] `docker-compose.yml` with Postgres, bound to `127.0.0.1`
- [x] Simple dev loop (`make dev`: backend with reload + Vite, SQLite by default, no floci needed)
- [x] CI: tests on SQLite and Postgres, image build + smoke test

Existing bugs found and fixed along the way:
- MCP server never worked (FastMCP lifespan not run; endpoint was `/mcp/mcp` while the UI showed `/mcp`).
- CI never ran backend tests (`pytest` wasn't installed); the deploy workflow's validation job had the same problem.
- Unpinned SQLAlchemy 2.1 defaults `postgresql://` to psycopg 3, which wasn't installed — the next image build would have failed to connect. Moved to psycopg 3, and fixed the app-role migration, whose role DDL used bind parameters Postgres rejects under psycopg 3.
- `logout()` sent no auth header, so sessions were never revoked server-side.
- A 401 redirected to a `login` route that didn't exist; `backend/__init__.py` loaded `.env` into every process that imported it.

### Phase 2 — De-brand / de-hardcode ✅
- [x] Domain / hosted zone / region configurable for the AWS deployment (no `kaseovo.com` in code) — CDK context or env vars, set by the deploy workflow from repository variables
- [x] Remove `infra/cdk.context.json` (now git-ignored), stale compose files and Dockerfiles
- [x] Landing page moved out of the public repo (with history) to a private `fastspec-website` repo; the wake page moved to `infra/wake-page/`
- [x] "Source code" link in the app (user menu), configurable with `SOURCE_URL` (AGPL network-use clause)
- [x] Removed the redundant GitHub "Auto-Stop" cron workflow (the WakeStack's EventBridge rule already does it)

Outside the repo (AWS/GitHub):
- [x] Private `Kaseovo/fastspec-website` repo created and pushed (with history), with its `AWS_ROLE_ARN` secret and `AWS_REGION` variable
- [x] FastSpec repo variables: `FASTSPEC_DOMAIN=fastspec.kaseovo.com`, `AWS_REGION=ap-southeast-1`; secret `HOSTED_ZONE_ID` (the fastspec.kaseovo.com zone)
- [x] `FastSpecGitHubDeploy` role's trust policy fixed (it still trusted `repo:DishWatcher/FastSpec:*`, so every AWS workflow failed; verified with a green Auto-Stop run on 2026-09-26). The Kaseovo repos use GitHub's immutable subject format, so it trusts exactly:
  - `repo:Kaseovo@167826072/FastSpec@1092682725:ref:refs/heads/main`
  - `repo:Kaseovo@167826072/fastspec-website@1388738583:ref:refs/heads/main`
- [x] Deleted the stale `SSH_HOST` / `SSH_KEY` / `SSH_PORT` / `SSH_USER` secrets and `REPO_PATH` variable (pre-AWS SSH deploy; unused)
- [ ] Retire that SSH key on the server it was for

The hosted stacks were shut down on 2026-09-23 to save costs until this work is ready; only the certificate stack and the hosted zones remain. Redeploy with the Deploy to AWS workflow once `open-source-release` is merged.

### Phase 3 — Open-source project files ✅
- [x] `LICENSE` (AGPL-3.0; `AGPL-3.0-only` in package metadata)
- [x] `CONTRIBUTING.md`, `SECURITY.md` (GitHub private vulnerability reporting), issue forms, PR template, `CHANGELOG.md`
- [x] Release pipeline (`release.yml`): version bump + tag → multi-arch image on GHCR + GitHub Release; AWS deploys are a separate workflow ([RELEASING.md](RELEASING.md))
- [x] Dependabot; backend dependencies pinned (`requirements*.in` → `make deps`); FastMCP beta → 3.4.7, FastAPI 0.141, Starlette 1.7
- [x] ruff and ESLint clean (from ≈300 / ≈1,500 findings) and enforced in CI
- [x] Docs refreshed: `ARCHITECTURE.md` (now also covers backend/frontend), `API.md`, `CONTEXT.md`; stale `BACKEND.md`, `FRONTEND.md`, `PROJECT_OVERVIEW.md` and `copilot-instructions.md` removed; the July code review kept as `docs/history/`
- [x] Code of Conduct (Contributor Covenant 2.1), reports to `conduct@kaseovo.com` (decision 8)
- [ ] Create the `conduct@kaseovo.com` alias (Cloudflare Email Routing)
- [x] README screenshots (form editor, YAML code view, preview — `docs/images/`)

### Phase 4 — v0.1 features ✅
- [x] YAML editing (view/edit as YAML, stored as JSON); lint markers positioned by path
- [x] Import from file upload / drag-and-drop / paste (JSON or YAML, OpenAPI 3.0/3.1)
- [x] Download as JSON or YAML
- [x] Swagger UI bundled instead of loaded from jsDelivr
- [x] "Start from an example" Petstore spec (lints clean), offered on the first visit
- [x] MCP tools: create / delete spec, list / get / save versions, compare, validate, lint

Found and fixed along the way: version comparisons were inverted; jumping to
a lint finding dropped the spec from the URL; switching specs kept the old
lint score; a missing Spectral CLI caused a 500.

### Phase 5 — Go public
- [x] History scrubbed on a fresh clone (decision 5) and published as a new public `Kaseovo/FastSpec` (2026-09-27). The original repository, with the unscrubbed history, old PRs and tags, is the private, archived `Kaseovo/FastSpec-archive` — a new repository because the old PRs pinned the old commits.
- [x] Private vulnerability reporting enabled; description, homepage and topics set
- [x] `v0.1.0` released (GitHub Release + multi-arch image on GHCR)
- [x] Google OAuth client: `https://fastspec.kaseovo.com/auth/oidc/callback` added as an authorized redirect URI
- [x] `ghcr.io/kaseovo/fastspec` package made public
- [x] Deploy role trust policy allows the new repository (`repo:Kaseovo@167826072/FastSpec@1390422681:ref:refs/heads/main`)
- [x] Hosted version and website redeployed (2026-09-28); the old database was gone, so it started empty
- [x] Secret-leak review: only a fine-grained GitHub token in old history (`.roo/mcp.json`), already revoked; deploy logs no longer print account/zone IDs or endpoints; gitleaks runs in CI

### Phase 6 — Near-zero hosting cost
An idle month cost about $17, mostly the stopped RDS instance's 100 GB disk. Target: cents ([ADR-0009](adr/0009-serverless-postgres.md)).
- [x] Database moved to a serverless Postgres (Neon free plan, AWS Singapore); Data and Wake stacks, wake page and waking-up screen removed
- [x] Unused `dev.fastspec.kaseovo.com` hosted zone deleted (`kaseovo.com` stays: Cloudflare delegates `dashboard`, `dashboard-api` and `instagram-api` to it)
- [x] Neon project created (AWS Singapore, Postgres 18) and `/prod/fastspec/database-url` stored in SSM
- [x] Deployed on Neon (2026-09-29); the RDS database was empty, so there was nothing to copy
- [ ] Old `FastSpec-Wake-prod` and `FastSpec-Data-prod` stacks deleted, RDS instance included (deletion protection on; it's retained by the stack)
- [ ] Leftovers removed: `/prod/fastspec/wake-secret` and `wake-last-triggered` SSM parameters, the `WAKE_SECRET` repository secret, `wake.html` in the landing bucket (and the website repo's sync exclusion for it)
- [ ] Old Lambda images: lifecycle rule on the CDK assets ECR repository (15 GB, $1.50/month)
- [ ] `fastspec.kaseovo.com` served from Cloudflare DNS instead of its own Route 53 zone ($0.50/month); needs the CDK stacks to support a domain without a hosted zone
- [ ] `robots.txt` on the landing site excluding `/specs` and `/api`

## Backlog (after v0.1)

| Item | Notes |
|---|---|
| Dark mode | PrimeVue theme currently has `darkModeSelector: false`. |
| Import from URL | Needs SSRF protection on the hosted version (server-side fetch) or a client-side fetch limited by CORS. |
| Stable raw spec URL for CI / codegen | e.g. `GET /specs/{id}/openapi.yaml` authenticated with an API key. |
| Read-only share links | New public-access surface; needs its own threat model. |
| Teams (shared specs, roles) | Build on real demand. |
| Git sync | Push/pull specs to a repository; separate design effort. |
| Preserve YAML comments/formatting | v0.1 stores specs as JSON, so YAML comments don't survive a save. Would require storing raw text and reworking versions/diff. |
| GitHub login | GitHub doesn't support OIDC for user sign-in; needs a dedicated OAuth2 provider. |
| Multiple OIDC providers at once | v0.1 supports one; config is shaped so a list can be added. |
| Trusted-header auth (oauth2-proxy, Authelia, Tailscale) | Only on request — dangerous when the app is reachable without the proxy. |
| Built-in email/password accounts | Not planned; OIDC covers teams more safely. |
