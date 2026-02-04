import inspect
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request
from functools import wraps
from fastmcp.server.context import Context
from auth.jwt import exchange_api_key_for_short_jwt

def get_authenticated_user() -> dict:
    request = get_http_request()

    if request:
        auth = request.headers.get("authorization")
        if auth and auth.startswith("Bearer "):
            token = auth[7:]

    if not token:
        raise PermissionError("Missing auth token")

    short_jwt = exchange_api_key_for_short_jwt(token)

    if not short_jwt:
        raise PermissionError("Invalid or expired token")

    return short_jwt


def require_auth(tool_fn):
    @wraps(tool_fn)
    async def wrapper(*args, **kwargs):
        user = get_authenticated_user()

        if inspect.iscoroutinefunction(tool_fn):
            return await tool_fn(*args, **kwargs)
        else:
            return tool_fn(*args, **kwargs)

    return wrapper


mcp = FastMCP(name="My MCP Server")


@mcp.tool
@require_auth
def greet() -> str:
    user = get_authenticated_user()
    return f"Hello, {user.get('access_token', 'Guest')}!"


@mcp.tool
@require_auth
def who_am_i(ctx: Context) -> dict:
    """
    Returns information about the authenticated user
    """
    # ctx.request_context.request.headers.get("authorization")
    user = get_authenticated_user()
    return user


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000, path="/")
