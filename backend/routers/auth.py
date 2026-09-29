"""
Authentication routes: sign-in, sessions and API keys.

Sign-in depends on AUTH_MODE (docs/adr/0006-auth-modes.md):

- ``none``: single-user mode. POST /local/session hands the SPA a JWT for the
  implicit local user — no credentials involved.
- ``oidc``: GET /oidc/login → provider consent screen → GET /oidc/callback →
  302 to the SPA's /specs/auth/callback with the FastSpec JWT in the URL
  fragment. Full-page redirects only (no popups), so it works in Brave and
  with popup blockers.

API keys (long-lived, for MCP clients) work the same in both modes.
"""

import logging
import secrets
from datetime import UTC, datetime
from functools import lru_cache
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from auth.jwt import (
    create_access_token,
    create_api_key,
    exchange_api_key_for_short_jwt,
    find_api_key_by_raw,
    verify_token,
)
from auth.oidc import OIDCClient, OIDCError, new_code_verifier
from auth.users import SignInRejected, get_or_create_local_user, upsert_oidc_user
from config import JWT_SECRET_KEY, settings
from database import get_db
from models import APIKey, AuthToken, User
from permissions import ALLOWED_ACTIONS, get_actions_metadata
from rate_limit import rate_limit
from schemas import (
    ApiKeyActionsResponse,
    ApiKeyActionsUpdateRequest,
    UserResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)
_bearer = HTTPBearer()

# Each of these endpoints triggers a real outbound call (token exchange with
# the provider, or a pbkdf2 hash check) — see docs/history/2026-07-code-review.md §6.
_oidc_callback_rate_limit = rate_limit(max_requests=20, window_seconds=60)
_api_key_exchange_rate_limit = rate_limit(max_requests=30, window_seconds=60)

# Short-lived, signed cookie binding the provider round-trip to this browser:
# CSRF state, the ID-token nonce and the PKCE verifier. SameSite=Lax is sent
# on the provider's top-level GET redirect back to /auth/oidc/callback.
OAUTH_STATE_COOKIE = "fastspec_oauth_state"
OAUTH_STATE_MAX_AGE_SECONDS = 600

# SPA route that finishes sign-in. The token travels in the URL *fragment*
# so it never reaches server logs or proxies.
SPA_CALLBACK_PATH = "/specs/auth/callback"


def _state_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(JWT_SECRET_KEY, salt="oidc-state")


@lru_cache(maxsize=1)
def _cached_oidc_client() -> OIDCClient:
    return OIDCClient(
        issuer=settings.oidc_issuer,
        client_id=settings.oidc_client_id,
        client_secret=settings.oidc_client_secret,
        redirect_uri=settings.oidc_redirect_uri,
        scopes=settings.oidc_scopes,
    )


def _oidc_client() -> OIDCClient:
    if settings.auth_mode != "oidc":
        raise HTTPException(status_code=404, detail="OIDC sign-in is not enabled")
    return _cached_oidc_client()


def _spa_redirect(fragment: str) -> RedirectResponse:
    """302 to the SPA's sign-in callback with a token/error in the fragment."""
    response = RedirectResponse(f"{SPA_CALLBACK_PATH}#{fragment}", status_code=302)
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/auth")
    return response


def _spa_error(message: str) -> RedirectResponse:
    return _spa_redirect(f"error={quote(message)}")


class TokenCreateRequest(BaseModel):
    actions: list[str]
    name: str | None = None


class ApiKeyExchangeRequest(BaseModel):
    api_key: str


class ApiKeyRevokeRequest(BaseModel):
    api_key: str


@router.get("/actions")
def list_available_actions():
    """Return all available actions that can be assigned to API keys."""
    return get_actions_metadata()


@router.get("/config")
def auth_config():
    """Public: tells the SPA how to sign in on this instance."""
    if settings.auth_mode == "oidc":
        return {
            "mode": "oidc",
            "provider_name": settings.oidc_display_name,
            "login_url": "/auth/oidc/login",
        }
    return {"mode": "none", "provider_name": None, "login_url": None}


@router.post("/local/session")
def local_session(db: Session = Depends(get_db)):
    """Single-user mode only: issue a session for the implicit local user."""
    if settings.auth_mode != "none":
        raise HTTPException(status_code=404, detail="Not found")
    user = get_or_create_local_user(db)
    token = create_access_token(user.id, user.email, db_session=db)
    return {
        "access_token": token,
        "user": UserResponse.model_validate(user).model_dump(mode="json"),
    }


@router.get("/oidc/login")
def oidc_login():
    """Start the OIDC Authorization Code + PKCE flow (full-page redirect)."""
    client = _oidc_client()
    state = secrets.token_urlsafe(16)
    nonce = secrets.token_urlsafe(16)
    verifier = new_code_verifier()
    try:
        url = client.authorization_url(state, nonce, verifier)
    except OIDCError:
        logger.exception("OIDC discovery failed")
        return _spa_error("Sign-in is temporarily unavailable, please try again later")

    response = RedirectResponse(url, status_code=302)
    response.set_cookie(
        OAUTH_STATE_COOKIE,
        _state_serializer().dumps({"state": state, "nonce": nonce, "verifier": verifier}),
        max_age=OAUTH_STATE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=settings.public_url.startswith("https"),
        path="/auth",
    )
    return response


@router.get("/oidc/callback", dependencies=[Depends(_oidc_callback_rate_limit)])
def oidc_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """Provider redirect target: validate state, exchange the code, verify
    the ID token, upsert the user, then hand the SPA a FastSpec JWT.

    Every failure redirects to the SPA with #error=… so the user is never
    stranded on a JSON error page.
    """
    client = _oidc_client()
    if error:
        return _spa_error(f"Sign-in was cancelled or refused ({error})")
    if not code or not state:
        return _spa_error("Missing authorization code")

    try:
        pending = _state_serializer().loads(
            request.cookies.get(OAUTH_STATE_COOKIE, ""),
            max_age=OAUTH_STATE_MAX_AGE_SECONDS,
        )
    except SignatureExpired:
        return _spa_error("Sign-in session expired, please try again")
    except BadSignature:
        return _spa_error("Sign-in session mismatch, please try again")
    if not secrets.compare_digest(str(pending.get("state", "")), state):
        return _spa_error("Sign-in session mismatch, please try again")

    try:
        id_token = client.exchange_code(code, pending["verifier"])
        claims = client.verify_id_token(id_token, pending["nonce"])
    except OIDCError:
        logger.exception("OIDC sign-in failed")
        return _spa_error("Could not complete sign-in, please try again")

    try:
        user = upsert_oidc_user(db, settings.oidc_provider_key, claims, settings)
        access_token = create_access_token(user.id, user.email, db_session=db)
    except SignInRejected as exc:
        return _spa_error(str(exc))
    except OperationalError:
        # A browser navigation: send it back to the app with a message rather
        # than leave it on a JSON error.
        logger.warning("Database unavailable during sign-in", exc_info=True)
        return _spa_error("The database is unavailable, please try again shortly.")

    return _spa_redirect(f"token={access_token}")


# Exchange an api_key for a short-lived JWT
@router.post("/api-keys/exchange", dependencies=[Depends(_api_key_exchange_rate_limit)])
def exchange_api_key(
    payload: ApiKeyExchangeRequest, db: Session = Depends(get_db)
):
    """Validate an API key string and return a short-lived JWT with actions."""
    short_jwt, expires_at = exchange_api_key_for_short_jwt(payload.api_key, db_session=db)
    return {"access_token": short_jwt, "expires_at": expires_at}


# Revoke an api_key (requires short JWT auth)
@router.post("/api-keys/revoke")
def revoke_api_key(
    payload: ApiKeyRevokeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    api_key_raw = payload.api_key
    token_rec = find_api_key_by_raw(db, api_key_raw)
    if not token_rec or token_rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="api_key not found")
    token_rec.revoked = True
    db.add(token_rec)
    db.commit()
    return {"message": "api_key revoked"}


@router.get("/api-keys")
def list_api_keys(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    tokens = (
        db.query(APIKey)
        .filter(APIKey.user_id == current_user.id)
        .order_by(APIKey.created_at.desc())
        .all()
    )
    result = []
    now = datetime.now(UTC)
    for t in tokens:
        exp = t.expires_at
        if not exp:
            continue
        # normalize naive datetimes returned by some DB drivers to UTC-aware
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=UTC)
        if exp < now:
            continue
        result.append(
            {
                "id": t.id,
                "name": t.name,
                "actions": t.get_actions(),
                "expires_at": exp,
                "revoked": t.revoked,
                "created_at": t.created_at,
                "last_used_at": t.last_used_at,
            }
        )
    return result


@router.post("/api-keys")
def create_api_key_route(
    payload: TokenCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # basic validation
    if not set(payload.actions).issubset(ALLOWED_ACTIONS):
        raise HTTPException(status_code=400, detail="Invalid actions")
    raw, rt, expires_at = create_api_key(db, current_user, payload.actions)
    rt.name = payload.name
    db.add(rt)
    db.commit()
    return {"api_key": raw, "id": rt.id, "expires_at": expires_at}


@router.delete("/api-keys/{id}")
def revoke_api_key_by_id(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rt = (
        db.query(APIKey)
        .filter(APIKey.id == id, APIKey.user_id == current_user.id)
        .first()
    )
    if not rt:
        raise HTTPException(status_code=404, detail="api_key not found")
    rt.revoked = True
    db.add(rt)
    db.commit()
    return {"message": "api_key revoked"}


@router.put("/api-keys/{id}/actions", response_model=ApiKeyActionsResponse)
def update_api_key_actions(
    id: str,
    payload: ApiKeyActionsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the actions allowed for a given api_key by id.

    Validates token ownership and that provided actions are a subset of
    ALLOWED_ACTIONS before persisting the change.
    """
    rt = (
        db.query(APIKey)
        .filter(APIKey.id == id, APIKey.user_id == current_user.id)
        .first()
    )
    if not rt:
        raise HTTPException(status_code=404, detail="api_key not found")
    if not set(payload.actions).issubset(ALLOWED_ACTIONS):
        raise HTTPException(status_code=400, detail="Invalid actions")
    rt.set_actions(payload.actions)
    if payload.name is not None:
        rt.name = payload.name
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return {
        "message": "api_key actions updated",
        "actions": rt.get_actions(),
        "name": rt.name,
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information
    Requires valid JWT token in Authorization header
    """
    return current_user


@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Logout endpoint: revoke the AuthToken associated with the presented JWT.
    Expects Authorization header with Bearer token.
    """
    token_str = credentials.credentials
    # decode to get jti
    token_data = verify_token(token_str)
    jti = token_data.get("jti")
    if jti:
        token_rec = (
            db.query(AuthToken)
            .filter(AuthToken.jti == jti, AuthToken.user_id == current_user.id)
            .first()
        )
        if token_rec:
            token_rec.revoked = True
            db.add(token_rec)
            db.commit()
    return {"message": "Logged out successfully"}
