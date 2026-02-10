from fastmcp import FastMCP
from fastmcp_server.middleware import LoggingMiddleware, AuthenticationMiddleware
from fastmcp.exceptions import ToolError
from fastmcp_server.authentication import get_short_jwt_from_request, validate_short_jwt
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
def who_am_i() -> dict:
    """
    Returns information about the authenticated user
    """
    # ctx.request_context.request.headers.get("authorization")
    return {"test": "data"}


@mcp.tool(tags={"authentication"}, meta={"actions": ["A", "B"]})
def get_saved_specs_for_user() -> list:
    """Return saved OpenAPI specs for the authenticated user.

    Authentication: reads Authorization header (Bearer token). Supports API key exchange -> short JWT and short JWT validation via existing utilities.
    """

    # See how can improve that
    try:
        short_jwt = get_short_jwt_from_request()
        payload = validate_short_jwt(short_jwt)
        user_id = int(payload.get("sub"))
    except PermissionError as e:
        raise ToolError(str(e))
    except Exception as e:
        raise ToolError(f"Authentication error: {e}")

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
            try:
                spec_json = json.loads(s.spec_json)
            except Exception:
                spec_json = {}
            result.append(
                {
                    "id": s.id,
                    "name": s.name,
                    "title": s.title,
                    "version": s.version,
                    "spec_json": spec_json,
                    "user_id": s.user_id,
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
