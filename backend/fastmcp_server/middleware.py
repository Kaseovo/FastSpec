from fastmcp.server.middleware import Middleware, MiddlewareContext
from fastmcp.exceptions import ToolError
from fastmcp_server.authentication import check_tool, get_short_jwt_from_request, validate_short_jwt

class LoggingMiddleware(Middleware):
    async def on_message(self, context: MiddlewareContext, call_next):
        print(f"→ {context.method}")
        result = await call_next(context)
        print(f"← {context.method}")
        return result
    
class AuthenticationMiddleware(Middleware):
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
        self.user = validate_short_jwt(get_short_jwt_from_request())
        print(self.user)
        result = await call_next(context)
        return result