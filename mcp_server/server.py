import os
from fastmcp import FastMCP
from fastmcp.server.auth.providers.jwt import JWTVerifier

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


verifier = JWTVerifier(
    public_key="your-super-secret-jwt-key-change-in-production",  # Despite the name, this accepts symmetric secrets
    issuer="internal-auth-service",
    audience="mcp-internal-api",
    algorithm="HS256",  # or HS384, HS512 for stronger security
)

mcp = FastMCP(name="My MCP Server", auth=verifier)


@mcp.tool
def greet(name: str) -> str:
    return f"Hello, {name}!"


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000, path="/")
