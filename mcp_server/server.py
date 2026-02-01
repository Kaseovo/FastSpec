import os
from fastmcp import FastMCP, Context
from fastmcp.server.auth.providers.jwt import JWTVerifier
import jwt
from jwt import PyJWTError



# MCP Debug : npx @modelcontextprotocol/inspector

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
JWT_SECRET = "your-super-secret-jwt-key-change-in-production-use-openssl-rand-hex-32"
JWT_ALGORITHM = "HS256"

from fastmcp.server.auth.providers.debug import DebugTokenVerifier

# Synchronous validation - check token prefix
verifier = JWTVerifier(
    public_key=JWT_SECRET,  # Despite the name, this accepts symmetric secrets
    # issuer="internal-auth-service",
    # audience="mcp-internal-api",
    algorithm=JWT_ALGORITHM  # or HS384, HS512 for stronger security
)


mcp = FastMCP(name="My MCP Server", auth=verifier)


def authenticate(context: Context) -> dict:
    auth_header = context.request_context.request.headers.get("authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise PermissionError("Missing or invalid Authorization header")

    token = auth_header.split(" ", 1)[1]

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
        return payload
    except PyJWTError as e:
        raise PermissionError(f"Invalid token: {e}")


@mcp.tool
def greet(name: str) -> str:
    return f"Hello, {name}!"

@mcp.tool()
def who_am_i(context: Context) -> dict:
    """
    Returns information about the authenticated user
    based on the JWT token.
    """
    claims = authenticate(context)

    return {
        "user_id": claims.get("sub"),
        "email": claims.get("email"),
        "roles": claims.get("roles", []),
        "issued_at": claims.get("iat"),
        "expires_at": claims.get("exp"),
    }

if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000, path="/")
