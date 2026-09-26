import logging

from fastmcp.exceptions import ToolError
from fastmcp.server.middleware import Middleware, MiddlewareContext

from fastmcp_server.authentication import (
    check_tool,
    get_short_jwt_from_request,
    validate_short_jwt,
)

logger = logging.getLogger(__name__)


class LoggingMiddleware(Middleware):
    """Logs which MCP method/tool was called and whether it succeeded.

    Deliberately logs metadata only (method + tool name), never the
    message content or result -- those routinely carry full spec content
    and other user data, which has no business ending up in CloudWatch.
    """

    async def on_message(self, context: MiddlewareContext, call_next):
        name = (
            context.message.name if hasattr(context.message, "name") else ""
        )

        logger.info("-> %s %s", context.method, name)
        try:
            result = await call_next(context)
        except Exception:
            logger.info("x  %s %s (failed)", context.method, name)
            raise

        logger.info("<- %s %s", context.method, name)
        return result


class AuthenticationMiddleware(Middleware):
    """Request-safe authentication middleware.

    Stores per-request user information in the mutable request-scoped dict
    `context.fastmcp_context.extra['user']`.
    """

    def _get_extra(self, context: MiddlewareContext) -> dict | None:
        fctx = getattr(context, "fastmcp_context", None)
        if not fctx:
            return None
        extra = getattr(fctx, "extra", None)
        if extra is None:
            try:
                # Attempt to create a mutable extra dict on the fastmcp context
                fctx.extra = {}
                extra = fctx.extra
            except Exception:
                return None
        return extra

    def _get_user_from_extra(self, context: MiddlewareContext):
        extra = self._get_extra(context)
        if extra is None:
            return None
        return extra.get("user")

    def _set_user_in_extra(self, context: MiddlewareContext, user) -> bool:
        extra = self._get_extra(context)
        if extra is None:
            return False
        extra["user"] = user
        return True

    def get_user(self, context: MiddlewareContext):
        user = self._get_user_from_extra(context)

        if user is None:
            user = validate_short_jwt(get_short_jwt_from_request())
            self._set_user_in_extra(context, user)

        return user

    async def on_list_tools(self, context: MiddlewareContext, call_next):
        tools = await call_next(context)  # This is a list of FastMCP Tool objects

        # Ensure we have a request-scoped user in the mutable extra dict.
        # An unauthenticated tools/list request is a normal, expected case
        # (e.g. an MCP client probing available tools before authenticating)
        # and must surface as a client-facing ToolError, not a bare
        # PermissionError that crashes the request.
        try:
            user = self.get_user(context)
        except PermissionError as exc:
            raise ToolError(str(exc)) from exc

        # You can inspect metadata like tool.tags or tool.meta here
        # Filter out tools with "private" tag
        filtered_tools = []
        for tool in tools:
            if check_tool(tool, user):
                filtered_tools.append(tool)

        # Return modified list
        return filtered_tools

    async def on_call_tool(self, context: MiddlewareContext, call_next):
        if context.fastmcp_context:
            # Ensure the request-scoped user is set on the fastmcp_context.extra
            try:
                user = self.get_user(context)
            except PermissionError as exc:
                raise ToolError(str(exc)) from exc
            tool = await context.fastmcp_context.fastmcp.get_tool(context.message.name)

            if not check_tool(tool, user):
                raise ToolError("Tool not found")

        return await call_next(context)
