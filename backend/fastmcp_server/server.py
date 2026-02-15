from fastmcp import FastMCP
from fastmcp.dependencies import Depends
from fastmcp_server.middleware import LoggingMiddleware, AuthenticationMiddleware
from fastmcp.exceptions import ToolError
from fastmcp_server.authentication import get_current_user, TokenPayload
from database import SessionLocal
from models import OpenAPISpec
import json

mcp = FastMCP(name="My MCP Server")
mcp.add_middleware(LoggingMiddleware())
mcp.add_middleware(AuthenticationMiddleware())


@mcp.tool()
def greet() -> str:
    return "Hello !"


@mcp.tool(tags={"authentication"}, meta={"actions": ["A", "B"]})
def who_am_i(user: TokenPayload = Depends(get_current_user)) -> dict:
    """
    Returns information about the authenticated user
    """
    return {"sub": user.sub, "actions": user.actions, "token_type": user.token_type, "exp": user.exp, "iat": user.iat}


@mcp.tool(tags={"authentication"}, meta={"actions": ["A", "B"]})
def get_saved_specs_for_user(user: TokenPayload = Depends(get_current_user)) -> list:
    """
    Returns a list of OpenAPI specs saved by the authenticated user
    """

    # See how can improve that
    user_id = int(user.sub)

    db = SessionLocal()
    try:
        specs = (
            db.query(OpenAPISpec)
            .filter(OpenAPISpec.user_id == user_id)
            .order_by(OpenAPISpec.created_at.desc())
            .all()
        )

        result = []
        for s in specs:
            result.append(
                {
                    "id": s.id,
                    "name": s.name,
                    "title": s.title,
                    "version": s.version,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                }
            )

        return result
    except Exception as e:
        raise ToolError(f"Database error: {e}")
    finally:
        db.close()


# mcp.disable(tags={"authentication"})

if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000, path="/")
