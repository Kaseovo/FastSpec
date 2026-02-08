from fastmcp import FastMCP
from fastmcp_server.middleware import LoggingMiddleware, AuthenticationMiddleware

mcp = FastMCP(name="My MCP Server")
mcp.add_middleware(LoggingMiddleware())
mcp.add_middleware(AuthenticationMiddleware())

@mcp.tool()
def greet() -> str:
    return f"Hello !"


@mcp.tool(tags={"authentication"}, meta={"actions": ["A", "B"]})
def who_am_i() -> dict:
    """
    Returns information about the authenticated user
    """
    # ctx.request_context.request.headers.get("authorization")
    return {"test": "data"}

# mcp.disable(tags={"authentication"})

if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000, path="/")
