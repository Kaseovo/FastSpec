import os
import inspect
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request
from functools import wraps

def get_authenticated_user() -> dict:
    request = get_http_request()  

    if request:
        auth = request.headers.get("authorization")
        if auth and auth.startswith("Bearer "):
            token = auth[7:]

    if not token:
        raise PermissionError("Missing auth token")

    # session = verify_token(token)  # Redis / DB lookup
    # if not session:
    #     raise PermissionError("Invalid or expired token")

    # return session
    return {"user_id": "user1", "roles": ["premium_user"]}  # Mocked user



def require_auth(tool_fn):
    @wraps(tool_fn)
    async def wrapper(*args, **kwargs):
        if inspect.iscoroutinefunction(tool_fn):
            return await tool_fn(*args, **kwargs)
        else:
            return tool_fn(*args, **kwargs)

    return wrapper


mcp = FastMCP(name="My MCP Server")


@mcp.tool
def greet(name: str) -> str:
    return f"Hello, {name}!"


@mcp.tool
@require_auth
def who_am_i() -> str:
    """
    Returns information about the authenticated user
    based on the JWT token.
    """
    return "You are a premium user!"


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000, path="/")

# Notes for operators:
# - To enable the MCP server to automatically obtain short JWTs, set AUTH_SERVICE_URL and MCP_REFRESH_TOKEN
# - Example environment keys: AUTH_SERVICE_URL=http://backend:8000 MCP_REFRESH_TOKEN=<raw-refresh-token>
# - The helper get_short_jwt() demonstrates how to call /auth/exchange and cache the short token until expiry.
