"""Combined ASGI application for Lambda deployment.

FastMCP 3.0.0b1 ASGI API notes (investigated from installed package):
  - FastMCP exposes `mcp.http_app(transport="http")` (TransportMixin.http_app) which
    returns a StarletteWithLifespan — a Starlette ASGI app subclass.
  - Internally, `create_streamable_http_app` registers the MCP route at
    `streamable_http_path` (default: "/mcp" from Settings).
  - FastAPI's `app.mount("/mcp", mcp_asgi_app)` strips the "/mcp" prefix before
    delegating, so MCP clients reach the server at the path /mcp/mcp.
  - There is no separate `asgi_app` property or `get_asgi_app()` method; http_app()
    is the correct call.
"""

from main import app
from fastmcp_server.server import mcp

# Build the MCP Starlette ASGI app (transport="http" uses streamable-http protocol).
# Default internal route path is "/mcp" (streamable_http_path setting default).
mcp_asgi_app = mcp.http_app(transport="http")

# Mount the MCP ASGI app at /mcp on the FastAPI app.
# MCP clients connect at /mcp/mcp (FastAPI strips /mcp, Starlette handles /mcp).
app.mount("/mcp", mcp_asgi_app)

# Single ASGI application exported for Mangum and local ASGI servers.
application = app
