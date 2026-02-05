import inspect
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request
from functools import wraps
from fastmcp.server.context import Context
from auth.jwt import exchange_api_key_for_short_jwt, verify_short_jwt
from auth.redis_client import get_redis


def get_short_jwt_from_request() -> dict:
    request = get_http_request()

    if request:
        auth = request.headers.get("authorization")
        if auth and auth.startswith("Bearer "):
            token = auth[7:]

    if not token:
        raise PermissionError("Missing auth token")

    redis_client = get_redis()
    if redis_client and not redis_client.exists(token):
        short_jwt, expires_at = exchange_api_key_for_short_jwt(token)

        if not short_jwt:
            raise PermissionError("Invalid or expired token")

        redis_client.set(token, short_jwt, exat=expires_at)
    else:
        short_jwt = redis_client.get(token)

    return short_jwt


def validate_short_jwt(short_jwt: str) -> dict:
    try:
        payload = verify_short_jwt(short_jwt)
        return payload
    except Exception as e:
        raise PermissionError("Invalid or expired token") from e

def user_can_perform_actions(user: dict, actions: list[str]) -> bool:
    user_actions = user.get("actions", [])
    return any(action in user_actions for action in actions)

def require_auth(actions: list[str] = None):
    def decorator(tool_fn):
        @wraps(tool_fn)
        async def wrapper(*args, **kwargs):
            user = validate_short_jwt(get_short_jwt_from_request())

            if actions and not user_can_perform_actions(user, actions):
                raise PermissionError("User does not belong to required actions")

            if inspect.iscoroutinefunction(tool_fn):
                return await tool_fn(*args, **kwargs)
            else:
                return tool_fn(*args, **kwargs)

        return wrapper
    return decorator


mcp = FastMCP(name="My MCP Server")


@mcp.tool()
@require_auth()
def greet() -> str:
    user = validate_short_jwt(get_short_jwt_from_request())
    return f"Hello, {user.get('access_token', 'Guest')}!"


@mcp.tool
@require_auth(actions=["admin", "user"])
def who_am_i(ctx: Context) -> dict:
    """
    Returns information about the authenticated user
    """
    # ctx.request_context.request.headers.get("authorization")
    user = validate_short_jwt(get_short_jwt_from_request())
    return user


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000, path="/")
