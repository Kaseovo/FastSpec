from fastmcp.tools import Tool
from fastmcp.server.dependencies import get_http_request
from auth.jwt import exchange_api_key_for_short_jwt, verify_short_jwt
from auth.redis_client import get_redis
from fastmcp.exceptions import ToolError


def check_tool(tool: Tool, user: dict) -> bool:
    if "authentication" not in tool.tags:
        return True
    else:
        if all(action in user.get("actions", []) for action in tool.meta.get("actions", [])):
            return True
    
    return False


def get_short_jwt_from_request() -> str:
    request = get_http_request()
    token = None

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

def get_current_user() -> dict:
    """
    Dependency function to get the current authenticated user based on the short JWT in the request. This can be used in tool functions with Depends(get_current_user) to access the authenticated user's information.  
    """
    try:
        short_jwt = get_short_jwt_from_request()
        payload = validate_short_jwt(short_jwt)
    except PermissionError as e:
        raise ToolError(str(e))
    except Exception as e:
        raise ToolError(f"Authentication error: {e}")

    return payload