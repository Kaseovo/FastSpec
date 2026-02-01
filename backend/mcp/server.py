import os
from fastmcp import FastMCP, Context
from fastmcp.server.auth.providers.jwt import JWTVerifier
import jwt
from jwt import PyJWTError
import httpx
from datetime import datetime, timedelta

# MCP Debug : npx @modelcontextprotocol/inspector

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
JWT_SECRET = os.getenv(
    "JWT_SIGNING_KEY",
    os.getenv("JWT_SECRET_KEY", "your-super-secret-jwt-key-change-in-production"),
)
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Short-token exchange config for MCP client
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:8000")
MCP_REFRESH_TOKEN = os.getenv("MCP_REFRESH_TOKEN", None)

from fastmcp.server.auth.providers.debug import DebugTokenVerifier

# Synchronous validation - check token prefix
verifier = JWTVerifier(
    public_key=JWT_SECRET,  # Despite the name, this accepts symmetric secrets
    algorithm=JWT_ALGORITHM,  # or HS384, HS512 for stronger security
)


mcp = FastMCP(name="My MCP Server", auth=verifier)

# Simple in-process cache for a short JWT obtained via exchange
_cached_short = None
_cached_expires_at = None


async def get_short_jwt() -> str:
    """Obtain a short JWT from the auth service using a stored refresh token and cache it until expiry."""
    global _cached_short, _cached_expires_at
    now = datetime.utcnow()
    if (
        _cached_short
        and _cached_expires_at
        and _cached_expires_at > now + timedelta(seconds=5)
    ):
        return _cached_short
    if not MCP_REFRESH_TOKEN:
        raise RuntimeError("MCP_REFRESH_TOKEN not configured; cannot obtain short JWT")
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{AUTH_SERVICE_URL}/auth/exchange",
            json={"refresh_token": MCP_REFRESH_TOKEN},
            timeout=5.0,
        )
        resp.raise_for_status()
        data = resp.json()
        _cached_short = data.get("access_token")
        _cached_expires_at = (
            datetime.fromisoformat(data.get("expires_at"))
            if isinstance(data.get("expires_at"), str)
            else datetime.utcfromtimestamp(data.get("expires_at"))
        )
        return _cached_short


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

# Notes for operators:
# - To enable the MCP server to automatically obtain short JWTs, set AUTH_SERVICE_URL and MCP_REFRESH_TOKEN
# - Example environment keys: AUTH_SERVICE_URL=http://backend:8000 MCP_REFRESH_TOKEN=<raw-refresh-token>
# - The helper get_short_jwt() demonstrates how to call /auth/exchange and cache the short token until expiry.
