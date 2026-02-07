import inspect
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request
from functools import wraps
from fastmcp.server.context import Context
from auth.jwt import exchange_api_key_for_short_jwt, verify_short_jwt
from auth.redis_client import get_redis
from fastmcp.server.middleware import Middleware, MiddlewareContext
from fastmcp.exceptions import ToolError
from fastmcp.tools import Tool


def check_tool(tool: Tool, user: dict) -> bool:
    if "authentication" not in tool.tags:
        return True
    else:
        if all(action in user.get("actions", []) for action in tool.meta.get("actions", [])):
            return True
    
    return False


class LoggingMiddleware(Middleware):
    user = None

    async def on_list_tools(self, context: MiddlewareContext, call_next):
        tools = await call_next(context)  # This is a list of FastMCP Tool objects

        # You can inspect metadata like tool.tags or tool.meta here
        # Filter out tools with "private" tag
        filtered_tools = []
        for tool in tools:
            if check_tool(tool, self.user):
                filtered_tools.append(tool)

        # Return modified list
        return filtered_tools
    
    async def on_call_tool(self, context: MiddlewareContext, call_next):
        if context.fastmcp_context:
            tool = await context.fastmcp_context.fastmcp.get_tool(context.message.name)
            if not check_tool(tool, self.user):
                raise ToolError("Tool not found")

        return await call_next(context)
    
    async def on_message(self, context: MiddlewareContext, call_next):
        print(f"→ {context.method}")
        self.user = validate_short_jwt(get_short_jwt_from_request())
        print(self.user)
        result = await call_next(context)
        print(f"← {context.method}")
        return result

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
mcp.add_middleware(LoggingMiddleware())

@mcp.tool()
def greet() -> str:
    user = validate_short_jwt(get_short_jwt_from_request())
    return f"Hello, {user.get('access_token', 'Guest')}!"


@mcp.tool(tags={"authentication"}, meta={"actions": ["A", "B"]})
def who_am_i(ctx: Context) -> dict:
    """
    Returns information about the authenticated user
    """
    # ctx.request_context.request.headers.get("authorization")
    user = validate_short_jwt(get_short_jwt_from_request())
    return user

# mcp.disable(tags={"authentication"})

if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000, path="/")
