import logging
from types import SimpleNamespace

from fastapi import HTTPException
from fastmcp import FastMCP
from fastmcp.dependencies import Depends
from fastmcp.exceptions import ToolError
from starlette.requests import Request
from starlette.responses import JSONResponse

from database import SessionLocal
from fastmcp_server.authentication import TokenPayload, get_current_user
from fastmcp_server.middleware import AuthenticationMiddleware, LoggingMiddleware
from permissions import Action
from services.spec_service import SpecService

logger = logging.getLogger(__name__)

mcp = FastMCP(name="My MCP Server")
mcp.add_middleware(LoggingMiddleware())
mcp.add_middleware(AuthenticationMiddleware())


@mcp.custom_route("/api/health", methods=["GET"])
async def health(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


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

    user_id = int(user.sub)

    db = SessionLocal()
    try:
        service = SpecService(db)
        specs = service.list_specs(SimpleNamespace(id=user_id))
        return [
            {
                "id": s.id,
                "name": s.name,
                "title": s.title,
                "version": s.version,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
            for s in specs
        ]
    except Exception as e:
        logger.exception("MCP get_saved_specs_for_user failed")
        raise ToolError("Could not load specs") from e
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
        service = SpecService(db)
        spec = service.get_spec(SimpleNamespace(id=user_id), spec_id)
        return {
            "id": spec.id,
            "name": spec.name,
            "title": spec.title,
            "version": spec.version,
            "created_at": spec.created_at.isoformat() if spec.created_at else None,
            "updated_at": spec.updated_at.isoformat() if spec.updated_at else None,
            "content": spec.spec_json,
        }
    except HTTPException:
        raise ToolError("Spec not found or access denied") from None
    except Exception as e:
        logger.exception("MCP get_spec_details failed")
        raise ToolError("Could not load the spec") from e
    finally:
        db.close()


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000, path="/mcp")
