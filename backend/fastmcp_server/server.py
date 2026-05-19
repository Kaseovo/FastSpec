from fastmcp import FastMCP
from fastmcp.dependencies import Depends
from fastmcp_server.middleware import LoggingMiddleware, AuthenticationMiddleware
from fastmcp.exceptions import ToolError
from fastmcp_server.authentication import get_current_user, TokenPayload
from database import SessionLocal
from models import OpenAPISpec
from permissions import Action
import json

mcp = FastMCP(name="My MCP Server")
mcp.add_middleware(LoggingMiddleware())
mcp.add_middleware(AuthenticationMiddleware())


@mcp.tool()
def greet() -> str:
    return "Hello !"


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.READ_SPECS]})
def who_am_i(user: TokenPayload = Depends(get_current_user)) -> dict:
    """
    Returns information about the authenticated user
    """
    return {
        "sub": user.sub,
        "actions": user.actions,
        "token_type": user.token_type,
        "exp": user.exp,
        "iat": user.iat,
    }


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.READ_SPECS]})
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


@mcp.tool(tags={"authentication"}, meta={"actions": [Action.READ_SPECS]})
def get_spec_details(
    spec_id: str, user: TokenPayload = Depends(get_current_user)
) -> dict:
    """
    Returns the details of a specific OpenAPI spec saved by the authenticated user
    """

    user_id = int(user.sub)

    db = SessionLocal()
    try:
        spec = (
            db.query(OpenAPISpec)
            .filter(OpenAPISpec.id == spec_id, OpenAPISpec.user_id == user_id)
            .first()
        )

        if not spec:
            raise ToolError("Spec not found or access denied")

        return {
            "id": spec.id,
            "name": spec.name,
            "title": spec.title,
            "version": spec.version,
            "created_at": spec.created_at.isoformat() if spec.created_at else None,
            "updated_at": spec.updated_at.isoformat() if spec.updated_at else None,
            "content": spec.spec_json if spec.spec_json else None,
        }
    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"Database error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000, path="/")
