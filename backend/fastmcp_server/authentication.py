import logging
from dataclasses import dataclass
from typing import Any

from fastmcp.exceptions import ToolError
from fastmcp.server.dependencies import get_context, get_http_request
from fastmcp.tools import Tool

from auth.jwt import exchange_api_key_for_short_jwt, verify_short_jwt
from database import SessionLocal
from permissions import user_has_action

logger = logging.getLogger(__name__)


def check_tool(tool: Tool, user: dict) -> bool:
    if "authentication" not in tool.tags:
        return True

    user_actions = user.get("actions", [])
    required_actions = tool.meta.get("actions", [])

    if not required_actions:
        return True

    return user_has_action(user_actions, required_actions)


def get_short_jwt_from_request() -> str:
    """Resolve a usable short JWT from the request's Authorization header.

    Clients may present either a raw, long-lived API key (exchanged fresh
    here on every call) or a short JWT obtained from a prior
    /auth/api-keys/exchange call / prior MCP call (reused as-is, with its
    originating API key's revocation status re-checked — see
    verify_short_jwt). Without the reuse path, a client following the
    documented "exchange once, reuse for a few minutes" flow would never
    actually save any work, since every request would still be treated as a
    fresh raw API key.
    """
    request = get_http_request()
    token = None

    if request:
        auth = request.headers.get("authorization")
        if auth and auth.startswith("Bearer "):
            token = auth[7:]

    if not token:
        raise PermissionError("Missing auth token")

    db = SessionLocal()
    try:
        try:
            verify_short_jwt(token, db_session=db)
            return token
        except Exception:
            pass  # not a (currently valid) short JWT -- fall back to exchange

        try:
            short_jwt, expires_at = exchange_api_key_for_short_jwt(
                token, db_session=db
            )
        except Exception as exc:
            # Normalize to PermissionError regardless of the underlying
            # failure (invalid/revoked api_key, DB error, ...) -- callers
            # (AuthenticationMiddleware, get_current_user) only translate
            # PermissionError into a client-facing ToolError; anything else
            # escaping here would crash the request instead of cleanly
            # rejecting it.
            raise PermissionError("Invalid or expired token") from exc
    finally:
        db.close()

    if not short_jwt:
        raise PermissionError("Invalid or expired token")

    return short_jwt


@dataclass
class TokenPayload:
    sub: str
    actions: list[str]
    token_type: str
    exp: int
    iat: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "sub": self.sub,
            "actions": self.actions,
            "token_type": self.token_type,
            "exp": self.exp,
            "iat": self.iat,
        }

    # Provide dict-like access for backward compatibility with existing callers
    def get(self, key: str, default: Any | None = None) -> Any:
        if hasattr(self, key):
            return getattr(self, key)
        return default


def validate_short_jwt(short_jwt: str) -> TokenPayload:
    try:
        payload = verify_short_jwt(short_jwt)
        return TokenPayload(
            sub=payload.get("sub"),
            actions=payload.get("actions", []),
            token_type=payload.get("token_type"),
            exp=payload.get("exp"),
            iat=payload.get("iat"),
        )
    except Exception as e:
        raise PermissionError("Invalid or expired token") from e


def _cached_user_from_context() -> TokenPayload | None:
    """Return the user AuthenticationMiddleware already resolved for this
    request (stored in context.extra['user']), if any.

    AuthenticationMiddleware.get_user() runs before the tool call and does
    this exact same auth-token exchange to build the permission-check user;
    without this, every tool call paid for it twice (once in the middleware,
    once here via Depends(get_current_user)) — a full DB lookup + pbkdf2
    verify each time a raw API key is presented.
    """
    try:
        ctx = get_context()
    except RuntimeError:
        return None
    return getattr(ctx, "extra", None) and ctx.extra.get("user")


def get_current_user() -> TokenPayload:
    """
    Dependency function to get the current authenticated user based on the short JWT in the request. This can be used in tool functions with Depends(get_current_user) to access the authenticated user's information.
    """
    cached = _cached_user_from_context()
    if cached is not None:
        return cached

    try:
        short_jwt = get_short_jwt_from_request()
        payload = validate_short_jwt(short_jwt)
    except PermissionError as e:
        raise ToolError(str(e)) from e
    except Exception as e:
        logger.exception("MCP authentication failed")
        raise ToolError("Authentication error") from e

    return payload
