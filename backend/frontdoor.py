"""
Single-origin front door: one ASGI app that serves the API, the MCP server
and (when self-hosted) the built SPA from the same host and port.

    /api/...        → API, with the /api prefix removed (the SPA calls
                      /api/specs, /api/lint)
    /mcp            → MCP server (streamable HTTP)
    /specs, /specs/ → SPA (index.html for client-side routes), only when a
                      static directory is configured
    /               → redirect to /specs/, same condition
    everything else → API (/auth, /health, /version, /docs, /openapi.json,
                      and /specs itself when no SPA is served — Lambda,
                      where CloudFront serves the SPA from S3)

Same origin means no CORS, and the OIDC state cookie, the sign-in callback
and the SPA all share one host.
"""

from pathlib import Path

from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import FileResponse, PlainTextResponse, RedirectResponse
from starlette.routing import Mount, Route, Router
from starlette.types import ASGIApp, Receive, Scope, Send

SPA_PREFIX = "/specs"
ASSET_CACHE = "public, max-age=31536000, immutable"


class SpaFiles:
    """Serve a Vite build: real files as-is, anything else → index.html."""

    def __init__(self, directory: str):
        self.root = Path(directory).resolve()
        self.index = self.root / "index.html"
        if not self.index.is_file():
            raise RuntimeError(f"FASTSPEC_STATIC_DIR={directory} has no index.html")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Path relative to the /specs mount, e.g. "assets/app.js".
        path, root = scope["path"], scope.get("root_path", "")
        if root and path.startswith(root):
            path = path[len(root) :]
        rel = path.lstrip("/")
        candidate = (self.root / rel).resolve() if rel else self.index

        if candidate != self.index and candidate.is_file() and candidate.is_relative_to(self.root):
            headers = {"Cache-Control": ASSET_CACHE} if rel.startswith("assets/") else {}
            response = FileResponse(candidate, headers=headers)
        elif Path(rel).suffix and rel != "index.html":
            # A missing asset: don't answer with HTML the browser can't use.
            response = PlainTextResponse("Not found", status_code=404)
        else:
            response = FileResponse(self.index, headers={"Cache-Control": "no-cache"})
        await response(scope, receive, send)


class FrontDoor:
    def __init__(self, api: ASGIApp, mcp: ASGIApp, static_dir: str | None = None):
        self.api = api
        routes = [
            Mount("/api", app=api),
            Route("/mcp", endpoint=mcp, methods=["GET", "POST", "DELETE"]),
        ]
        if static_dir:
            spa = GZipMiddleware(SpaFiles(static_dir), minimum_size=1024)
            routes += [
                Route("/", endpoint=_redirect_to_spa),
                Route(SPA_PREFIX, endpoint=_redirect_to_spa),
                Mount(SPA_PREFIX, app=spa),
            ]
        routes.append(Mount("", app=api))
        self.router = Router(routes=routes)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "lifespan":
            # The API app owns startup/shutdown (including the MCP session
            # manager — see app.py).
            await self.api(scope, receive, send)
            return
        await self.router(scope, receive, send)


async def _redirect_to_spa(request):
    return RedirectResponse(f"{SPA_PREFIX}/", status_code=307)
