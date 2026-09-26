# ADR-0008: Single-image self-hosting and a stateless MCP endpoint

**Status:** Accepted, implemented
**Date:** 2026-09-26
**Supersedes, in part:** ADR-0001 (floci stays for working on the AWS
deployment; it is no longer the way to run FastSpec locally)

## Context

Running FastSpec locally required floci, the AWS CDK and Google OAuth
credentials (ADR-0001). That's right for maintaining the hosted AWS
deployment, but far too much for someone who wants to try the app.
Production gets a single origin from CloudFront (`/specs*` → S3,
`/api*`, `/auth*`, `/mcp*` → Lambda), and the sign-in flow depends on it.
Locally, the landing page (port 3000) and SPA (port 5173) were different
origins, so the token the log-in page stored was invisible to the SPA.

Separately, the MCP server didn't work at all. FastMCP's streamable-HTTP
session manager needs its lifespan to run, and FastAPI doesn't run the
lifespans of mounted sub-apps, so every MCP request failed with "task group
is not initialized". Its endpoint was also `/mcp/mcp`, while the UI showed
users `/mcp`.

## Decision

### One image, one origin

The root `Dockerfile` builds the SPA, installs the Spectral CLI and ships a
slim Python runtime that serves everything on port 8080. `frontdoor.py`
routes a single origin the way CloudFront does in production:

| Path | Goes to |
|---|---|
| `/api/...` | API, with `/api` stripped |
| `/mcp` | MCP server |
| `/specs`, `/specs/...` | built SPA (`index.html` for client-side routes), when `FASTSPEC_STATIC_DIR` is set |
| `/` | redirect to `/specs/`, same condition |
| everything else | API (`/auth`, `/health`, `/docs`, …) |

On Lambda `FASTSPEC_STATIC_DIR` is unset, so `/specs` stays the API, as
before, and CloudFront keeps serving the SPA from S3.

`python cli.py serve` applies migrations and then starts uvicorn — the
container entrypoint. With no configuration, the container runs in
single-user mode (ADR-0006) on SQLite (ADR-0007) and generates a JWT
secret into `/data`.

### Stateless MCP, one handler per request

The MCP endpoint is exactly `/mcp`, runs FastMCP with
`stateless_http=True, json_response=True`, and builds a short-lived handler
per request (`app.py::StatelessMCP`). A process-wide session manager can
only be started once, and Mangum starts a fresh lifespan on every Lambda
invocation, so a shared manager would fail from the second invocation on.
All FastSpec MCP tools are simple request/response calls, so nothing is
lost without sessions or server-sent events.

### Development loop

`make dev` runs the backend with auto-reload plus the Vite dev server;
Vite proxies `/api`, `/auth` and `/mcp` to the backend unchanged, so the
dev setup routes exactly like the image. No Docker is needed for day-to-day
work.

## Consequences

- Quickstart is one `docker run`; `docker-compose.yml` adds Postgres for
  teams. The Traefik compose files, `Dockerfile-MCP`s, and the frontend
  nginx image are deleted.
- The MCP server works (tested end to end with an API key through the front
  door) and its URL is what the UI has always shown.
- The landing page is no longer part of running FastSpec. It remains the
  hosted version's marketing site.
- CI builds the image and smoke-tests a zero-configuration start.
