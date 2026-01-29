import os
from fastmcp import FastMCP
from fastmcp.server.auth.providers.github import GitHubProvider

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# The GitHubProvider handles GitHub's token format and validation
auth_provider = GitHubProvider(
    client_id=os.getenv("GITHUB_CLIENT_ID"),  # Your GitHub OAuth App Client ID
    client_secret=os.getenv(
        "GITHUB_CLIENT_SECRET"
    ),  # Your GitHub OAuth App Client Secret
    base_url=FRONTEND_URL,  # Must match your OAuth App configuration
    redirect_path="/auth/github/callback",  # Default value, customize if needed
)


mcp = FastMCP(name="My MCP Server", auth_provider=auth_provider)


@mcp.tool
def greet(name: str) -> str:
    return f"Hello, {name}!"


@mcp.tool
async def get_user_info() -> dict:
    """Returns information about the authenticated GitHub user."""
    from fastmcp.server.dependencies import get_access_token

    token = get_access_token()
    # The GitHubProvider stores user data in token claims
    return {
        "github_user": token.claims.get("login"),
        "name": token.claims.get("name"),
        "email": token.claims.get("email"),
    }


if __name__ == "__main__":
    mcp.run()
