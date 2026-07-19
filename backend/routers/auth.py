"""
Authentication routes for OAuth2 and JWT.

Google sign-in supports two flows:
- Redirect flow (primary): GET /google/login → Google consent screen →
  GET /google/callback → 302 to the log-in page with the FastSpec JWT in the
  URL fragment. Works in all browsers, including Brave and popup blockers.
- ID-token verification (legacy/programmatic): POST /google/verify accepts a
  Google ID token obtained client-side and returns a FastSpec JWT.
"""

import logging
import secrets
from datetime import datetime, timezone
from urllib.parse import quote, urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from config import JWT_SECRET_KEY, settings

from database import get_db
from models import User, AuthToken, APIKey
from schemas import (
    UserResponse,
    ApiKeyActionsUpdateRequest,
    ApiKeyActionsResponse,
)
from auth.jwt import (
    create_access_token,
    verify_token,
    find_api_key_by_raw,
    exchange_api_key_for_short_jwt,
    create_api_key,
)
from auth.dependencies import get_current_user
from permissions import ALLOWED_ACTIONS, get_actions_metadata
from rate_limit import rate_limit

router = APIRouter()
logger = logging.getLogger(__name__)

# Each of these endpoints triggers a real outbound call (Google token
# verification/exchange, or a pbkdf2 hash check) that costs money per
# invocation on Lambda — see docs/CODE_REVIEW.md §6.
_google_verify_rate_limit = rate_limit(max_requests=20, window_seconds=60)
_google_callback_rate_limit = rate_limit(max_requests=20, window_seconds=60)
_api_key_exchange_rate_limit = rate_limit(max_requests=30, window_seconds=60)

FRONTEND_URL = settings.frontend_url

# --- Google OAuth redirect-flow configuration ---

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

# CSRF-protection state: signed, short-lived, and bound to the browser via an
# HttpOnly cookie (SameSite=Lax is sent on Google's top-level GET redirect back).
OAUTH_STATE_COOKIE = "fastspec_oauth_state"
OAUTH_STATE_MAX_AGE_SECONDS = 600

# Where the browser lands after the callback. The token travels in the URL
# *fragment* so it never reaches server logs or proxies.
LOGIN_PAGE_PATH = "/log-in"


def _state_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(JWT_SECRET_KEY, salt="google-oauth-state")


def _google_client_id() -> str:
    client_id = settings.google_client_id
    if not client_id:
        # Never call Google verification with a missing audience — google-auth
        # would skip the audience check and accept tokens minted for any app.
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    return client_id


def _google_redirect_uri() -> str:
    return settings.google_redirect_uri


def _login_page_redirect(fragment: str) -> RedirectResponse:
    """302 to the log-in page with a token/error in the URL fragment."""
    response = RedirectResponse(
        f"{FRONTEND_URL}{LOGIN_PAGE_PATH}#{fragment}", status_code=302
    )
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/auth")
    return response


def _upsert_google_user(db: Session, id_info: dict) -> User:
    """Create or update the User record for a verified Google identity."""
    email = id_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    user = (
        db.query(User)
        .filter(User.email == email, User.provider == "google")
        .first()
    )

    if user:
        user.name = id_info.get("name")
        user.avatar_url = id_info.get("picture")
        user.provider_user_id = id_info.get("sub")
    else:
        user = User(
            email=email,
            name=id_info.get("name"),
            avatar_url=id_info.get("picture"),
            provider="google",
            provider_user_id=id_info.get("sub"),
        )
        db.add(user)

    db.commit()
    db.refresh(user)
    return user


class TokenCreateRequest(BaseModel):
    actions: List[str]
    name: Optional[str] = None


class ApiKeyExchangeRequest(BaseModel):
    api_key: str


class ApiKeyRevokeRequest(BaseModel):
    api_key: str


class GoogleVerifyRequest(BaseModel):
    id_token: str


@router.get("/actions")
def list_available_actions():
    """Return all available actions that can be assigned to API keys."""
    return get_actions_metadata()


@router.get("/google/login")
def google_login():
    """
    Start the Google OAuth 2.0 Authorization Code flow (full-page redirect).

    Redirects the browser to Google's consent screen. No popups — works in
    Brave and browsers with popup blockers. State is signed and mirrored in
    an HttpOnly cookie for CSRF protection.
    """
    client_id = _google_client_id()
    state = _state_serializer().dumps(secrets.token_urlsafe(16))

    params = {
        "client_id": client_id,
        "redirect_uri": _google_redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    response = RedirectResponse(
        f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}", status_code=302
    )
    response.set_cookie(
        OAUTH_STATE_COOKIE,
        state,
        max_age=OAUTH_STATE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=_google_redirect_uri().startswith("https"),
        path="/auth",
    )
    return response


@router.get("/google/callback", dependencies=[Depends(_google_callback_rate_limit)])
async def google_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Google OAuth callback: validate state, exchange the authorization code,
    verify the ID token, upsert the user, then redirect to the log-in page
    with the FastSpec JWT in the URL fragment (#token=…).

    All failures redirect to the log-in page with #error=… so the user is
    never stranded on a JSON error response.
    """
    if error:
        return _login_page_redirect(f"error={quote(error)}")
    if not code or not state:
        return _login_page_redirect(f"error={quote('Missing authorization code')}")

    # CSRF check: state must match the HttpOnly cookie AND carry a valid,
    # unexpired signature from this server.
    cookie_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not cookie_state or not secrets.compare_digest(cookie_state, state):
        return _login_page_redirect(
            f"error={quote('Sign-in session mismatch, please try again')}"
        )
    try:
        _state_serializer().loads(state, max_age=OAUTH_STATE_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return _login_page_redirect(
            f"error={quote('Sign-in session expired, please try again')}"
        )

    client_id = _google_client_id()
    client_secret = settings.google_client_secret
    if not client_secret:
        return _login_page_redirect(
            f"error={quote('Google sign-in is not configured')}"
        )

    # Exchange the authorization code for tokens
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            token_resp = await http.post(
                GOOGLE_TOKEN_ENDPOINT,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": _google_redirect_uri(),
                },
            )
        token_resp.raise_for_status()
        google_id_token = token_resp.json().get("id_token")
        if not google_id_token:
            raise ValueError("No id_token in Google token response")
    except Exception:
        logger.exception("Google OAuth token exchange failed")
        return _login_page_redirect(
            f"error={quote('Could not complete Google sign-in, please try again')}"
        )

    try:
        # google-auth defaults clock_skew_in_seconds to 0, so it hard-fails
        # on iat/exp checks over even a couple seconds of ordinary clock
        # drift between this machine and Google's token servers — give it
        # the same 10s tolerance jwt.decode() itself recommends.
        id_info = id_token.verify_oauth2_token(
            google_id_token,
            google_requests.Request(),
            client_id,
            clock_skew_in_seconds=10,
        )
    except Exception:
        logger.exception("Google ID token verification failed")
        return _login_page_redirect(
            f"error={quote('Invalid Google identity, please try again')}"
        )

    user = _upsert_google_user(db, id_info)
    access_token = create_access_token(user.id, user.email, db_session=db)

    return _login_page_redirect(f"token={access_token}")


@router.post("/google/verify", dependencies=[Depends(_google_verify_rate_limit)])
def verify_google_token(
    payload: GoogleVerifyRequest, db: Session = Depends(get_db)
):
    """
    Verify a Google ID token (obtained client-side, e.g. via Google Identity
    Services) and return a FastSpec JWT. Kept for programmatic clients; the
    browser flow uses GET /google/login → /google/callback.

    Accepts: { "id_token": "<Google ID token>" }
    Returns: { "access_token": "<FastSpec JWT>" }
    """
    google_client_id = _google_client_id()

    try:
        # See google_callback's identical call for why clock_skew_in_seconds
        # is set explicitly — google-auth defaults it to 0.
        id_info = id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            google_client_id,
            clock_skew_in_seconds=10,
        )
    except Exception:
        logger.exception("Google ID token verification failed")
        raise HTTPException(
            status_code=401, detail="Invalid or expired Google ID token"
        )

    user = _upsert_google_user(db, id_info)

    # Generate FastSpec JWT
    access_token = create_access_token(user.id, user.email, db_session=db)

    return {"access_token": access_token}


# New endpoint: exchange api_key for a short JWT
@router.post("/api-keys/exchange", dependencies=[Depends(_api_key_exchange_rate_limit)])
def exchange_api_key(
    payload: ApiKeyExchangeRequest, db: Session = Depends(get_db)
):
    """Validate an API key string and return a short-lived JWT with actions."""
    short_jwt, expires_at = exchange_api_key_for_short_jwt(payload.api_key, db_session=db)
    return {"access_token": short_jwt, "expires_at": expires_at}


# New endpoint: revoke an api_key (requires short JWT auth)
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
    now = datetime.now(timezone.utc)
    for t in tokens:
        exp = t.expires_at
        if not exp:
            continue
        # normalize naive datetimes returned by some DB drivers to UTC-aware
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
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
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
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
