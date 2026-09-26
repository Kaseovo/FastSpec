"""Combined ASGI application: FastAPI + MCP server (+ the built SPA when
self-hosted), exported as ``application`` for uvicorn and for Mangum on
Lambda. Routing between them lives in frontdoor.py.
"""

from config import settings
from fastmcp_server.server import mcp
from frontdoor import FrontDoor
from main import app


class StatelessMCP:
    """Serve each MCP request with its own short-lived stateless handler.

    FastMCP's streamable-HTTP session manager must be started by a lifespan,
    and can only be started once per instance. Lambda (Mangum) runs a fresh
    lifespan per invocation, so a process-wide manager breaks on the second
    request there. In stateless mode every request is independent anyway, so
    building the handler per request costs little and behaves the same on
    uvicorn, Lambda and in tests. Plain JSON responses (no SSE) keep it
    compatible with Lambda's buffered responses; all FastSpec tools are
    simple request/response calls.
    """

    async def __call__(self, scope, receive, send):
        handler = mcp.http_app(path="/mcp", stateless_http=True, json_response=True)
        async with handler.router.lifespan_context(handler):
            await handler(scope, receive, send)


mcp_asgi_app = StatelessMCP()

application = FrontDoor(app, mcp_asgi_app, static_dir=settings.static_dir)
