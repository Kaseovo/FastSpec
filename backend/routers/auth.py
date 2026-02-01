"""
Authentication routes for OAuth2 and JWT
"""

import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import json

from database import get_db
from models import User, CustomToken, AuthToken, RefreshToken
from schemas import (
    UserResponse,
    RefreshActionsUpdateRequest,
    RefreshActionsResponse,
    CustomTokenActionsUpdateRequest,
    CustomTokenActionsResponse,
)
from auth.oauth import oauth, get_google_user_info, get_github_user_info
from auth.jwt import (
    create_access_token,
    create_custom_token,
    verify_custom_token,
    refresh_custom_token,
    verify_token,
    generate_refresh_token,
    hash_refresh_token,
    find_refresh_token_by_raw,
    create_short_jwt,
    create_refresh_token,
)
from auth.dependencies import get_current_user

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class TokenCreateRequest(BaseModel):
    actions: List[str]


class TokenIntrospectRequest(BaseModel):
    token: str


class RefreshExchangeRequest(BaseModel):
    refresh_token: str


class RefreshRevokeRequest(BaseModel):
    refresh_token: str


ALLOWED_ACTIONS = {"A", "B"}


@router.post("/tokens", status_code=status.HTTP_201_CREATED)
async def create_token(
    payload: TokenCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # basic validation
    if not set(payload.actions).issubset(ALLOWED_ACTIONS):
        raise HTTPException(status_code=400, detail="Invalid actions")
    token_str, jti, expires_at = create_custom_token(db, current_user, payload.actions)
    return {"token": token_str, "jti": jti, "expires_at": expires_at}


@router.get("/tokens")
async def list_tokens(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    tokens = (
        db.query(CustomToken)
        .filter(CustomToken.user_id == current_user.id)
        .order_by(CustomToken.created_at.desc())
        .all()
    )
    result = []
    now = datetime.utcnow()
    for t in tokens:
        if t.expires_at < now:
            continue
        result.append(
            {
                "jti": t.jti,
                "actions": t.get_actions(),
                "expires_at": t.expires_at,
                "revoked": t.revoked,
                "created_at": t.created_at,
            }
        )
    return result


@router.delete("/tokens/{jti}")
async def revoke_token(
    jti: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token = (
        db.query(CustomToken)
        .filter(CustomToken.jti == jti, CustomToken.user_id == current_user.id)
        .first()
    )
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    token.revoked = True
    db.add(token)
    db.commit()
    return {"message": "Token revoked"}


@router.post("/tokens/{jti}/refresh")
async def refresh_token(
    jti: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token = (
        db.query(CustomToken)
        .filter(CustomToken.jti == jti, CustomToken.user_id == current_user.id)
        .first()
    )
    if not token or token.revoked:
        raise HTTPException(status_code=404, detail="Token not found")
    new_token, new_expires = refresh_custom_token(db, current_user, jti)
    return {"token": new_token, "expires_at": new_expires}


@router.post("/tokens/introspect")
async def introspect_token(
    payload: TokenIntrospectRequest, db: Session = Depends(get_db)
):
    try:
        data = verify_custom_token(db, payload.token)
        return {
            "active": True,
            "user_id": data["user_id"],
            "actions": data["actions"],
            "expires_at": data["expires_at"],
        }
    except HTTPException:
        return {"active": False}


# New endpoint: exchange refresh token for a short JWT
@router.post("/refresh/exchange")
async def exchange_refresh_token(
    payload: RefreshExchangeRequest, db: Session = Depends(get_db)
):
    """Validate a refresh token string and return a short-lived JWT with actions."""
    raw = payload.refresh_token
    token_rec = find_refresh_token_by_raw(db, raw)
    now = datetime.utcnow()
    if not token_rec or token_rec.revoked or token_rec.expires_at < now:
        raise HTTPException(status_code=401, detail="Invalid or revoked refresh token")

    # Issue short JWT with actions embedded
    actions = token_rec.get_actions()
    short_jwt, expires_at = create_short_jwt(token_rec.user_id, actions)

    # update last_used_at
    token_rec.last_used_at = now
    db.add(token_rec)
    db.commit()

    return {"access_token": short_jwt, "expires_at": expires_at}


# New endpoint: revoke a refresh token (requires short JWT auth)
@router.post("/refresh/revoke")
async def revoke_refresh_token(
    payload: RefreshRevokeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raw = payload.refresh_token
    token_rec = find_refresh_token_by_raw(db, raw)
    if not token_rec or token_rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Refresh token not found")
    token_rec.revoked = True
    db.add(token_rec)
    db.commit()
    return {"message": "Refresh token revoked"}


@router.get("/refresh")
async def list_refresh_tokens(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    tokens = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == current_user.id)
        .order_by(RefreshToken.created_at.desc())
        .all()
    )
    result = []
    now = datetime.utcnow()
    for t in tokens:
        if t.expires_at < now:
            continue
        result.append(
            {
                "id": t.id,
                "actions": t.get_actions(),
                "expires_at": t.expires_at,
                "revoked": t.revoked,
                "created_at": t.created_at,
                "last_used_at": t.last_used_at,
            }
        )
    return result


@router.post("/refresh")
async def create_refresh(
    payload: TokenCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # basic validation
    if not set(payload.actions).issubset(ALLOWED_ACTIONS):
        raise HTTPException(status_code=400, detail="Invalid actions")
    raw, rt, expires_at = create_refresh_token(db, current_user, payload.actions)
    return {"refresh_token": raw, "id": rt.id, "expires_at": expires_at}


@router.delete("/refresh/{id}")
async def revoke_refresh(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rt = (
        db.query(RefreshToken)
        .filter(RefreshToken.id == id, RefreshToken.user_id == current_user.id)
        .first()
    )
    if not rt:
        raise HTTPException(status_code=404, detail="Refresh token not found")
    rt.revoked = True
    db.add(rt)
    db.commit()
    return {"message": "Refresh token revoked"}


@router.put("/refresh/{id}/actions", response_model=RefreshActionsResponse)
async def update_refresh_token_actions(
    id: str,
    payload: RefreshActionsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the actions allowed for a given refresh token by id.

    Validates token ownership and that provided actions are a subset of
    ALLOWED_ACTIONS before persisting the change.
    """
    rt = (
        db.query(RefreshToken)
        .filter(RefreshToken.id == id, RefreshToken.user_id == current_user.id)
        .first()
    )
    if not rt:
        raise HTTPException(status_code=404, detail="Refresh token not found")
    if not set(payload.actions).issubset(ALLOWED_ACTIONS):
        raise HTTPException(status_code=400, detail="Invalid actions")
    rt.set_actions(payload.actions)
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return {
        "message": "Refresh token actions updated",
        "actions": rt.get_actions(),
    }


@router.put("/tokens/{jti}/actions", response_model=CustomTokenActionsResponse)
async def update_custom_token_actions(
    jti: str,
    payload: CustomTokenActionsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the actions allowed for a given custom token.

    Validates token ownership, that it is not revoked, and that provided
    actions are a subset of ALLOWED_ACTIONS before persisting the change.
    """
    token_rec = (
        db.query(CustomToken)
        .filter(CustomToken.jti == jti, CustomToken.user_id == current_user.id)
        .first()
    )
    if not token_rec or token_rec.revoked:
        raise HTTPException(status_code=404, detail="Token not found")
    if not set(payload.actions).issubset(ALLOWED_ACTIONS):
        raise HTTPException(status_code=400, detail="Invalid actions")
    token_rec.set_actions(payload.actions)
    db.add(token_rec)
    db.commit()
    db.refresh(token_rec)
    return {
        "message": "Custom token actions updated",
        "actions": token_rec.get_actions(),
    }


@router.post("/tokens/introspect")
async def _introspect_duplicate():
    # placeholder to avoid route collision in some setups; real introspect above
    return {"active": False}


# existing oauth routes and callbacks (unchanged) ...


@router.get("/google")
async def login_google(request: Request):
    """
    Initiate Google OAuth flow
    Redirects user to Google consent page
    """
    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI", f"{FRONTEND_URL}/auth/google/callback"
    )
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """
    Handle Google OAuth callback
    Exchange authorization code for access token and create/update user
    """
    try:
        # Get access token from Google
        token = await oauth.google.authorize_access_token(request)

        # Extract user information
        user_info = await get_google_user_info(token)

        if not user_info.get("email"):
            raise HTTPException(status_code=400, detail="Email not provided by Google")

        # Check if user exists
        user = (
            db.query(User)
            .filter(User.email == user_info["email"], User.provider == "google")
            .first()
        )

        if user:
            # Update existing user
            user.name = user_info.get("name")
            user.avatar_url = user_info.get("avatar_url")
            user.provider_user_id = user_info.get("provider_user_id")
        else:
            # Create new user
            user = User(
                email=user_info["email"],
                name=user_info.get("name"),
                avatar_url=user_info.get("avatar_url"),
                provider="google",
                provider_user_id=user_info.get("provider_user_id"),
            )
            db.add(user)

        db.commit()
        db.refresh(user)

        # Generate JWT token and persist it
        access_token = create_access_token(user.id, user.email, db_session=db)

        # Generate refresh token (plaintext returned once) and persist hash
        raw_refresh = generate_refresh_token()
        hashed = hash_refresh_token(raw_refresh)
        expires_at = datetime.utcnow() + timedelta(
            days=int(os.getenv("REFRESH_TOKEN_TTL_DAYS", "30"))
        )
        rt = RefreshToken(
            token_hash=hashed,
            user_id=user.id,
            actions=json.dumps([]),
            expires_at=expires_at,
        )
        db.add(rt)
        db.commit()
        db.refresh(rt)

        # Redirect to frontend with token and refresh token (refresh token shown once)
        redirect_url = (
            f"{FRONTEND_URL}/?token={access_token}&refresh_token={raw_refresh}"
        )
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        error_url = f"{FRONTEND_URL}/?error={str(e)}"
        return RedirectResponse(url=error_url)


@router.get("/github")
async def login_github(request: Request):
    """
    Initiate GitHub OAuth flow
    Redirects user to GitHub authorization page
    """
    redirect_uri = os.getenv(
        "GITHUB_REDIRECT_URI", f"{FRONTEND_URL}/auth/github/callback"
    )
    return await oauth.github.authorize_redirect(request, redirect_uri)


@router.get("/github/callback")
async def github_callback(request: Request, db: Session = Depends(get_db)):
    """
    Handle GitHub OAuth callback
    Exchange authorization code for access token and create/update user
    """
    try:
        # Get access token from GitHub
        token = await oauth.github.authorize_access_token(request)

        # Extract user information
        user_info = await get_github_user_info(token)

        if not user_info.get("email"):
            raise HTTPException(status_code=400, detail="Email not provided by GitHub")

        # Check if user exists
        user = (
            db.query(User)
            .filter(User.email == user_info["email"], User.provider == "github")
            .first()
        )

        if user:
            # Update existing user
            user.name = user_info.get("name")
            user.avatar_url = user_info.get("avatar_url")
            user.provider_user_id = user_info.get("provider_user_id")
        else:
            # Create new user
            user = User(
                email=user_info["email"],
                name=user_info.get("name"),
                avatar_url=user_info.get("avatar_url"),
                provider="github",
                provider_user_id=user_info.get("provider_user_id"),
            )
            db.add(user)

        db.commit()
        db.refresh(user)

        # Generate JWT token and persist it
        access_token = create_access_token(user.id, user.email, db_session=db)

        # Generate refresh token (plaintext returned once) and persist hash
        raw_refresh = generate_refresh_token()
        hashed = hash_refresh_token(raw_refresh)
        expires_at = datetime.utcnow() + timedelta(
            days=int(os.getenv("REFRESH_TOKEN_TTL_DAYS", "30"))
        )
        rt = RefreshToken(
            token_hash=hashed,
            user_id=user.id,
            actions=json.dumps([]),
            expires_at=expires_at,
        )
        db.add(rt)
        db.commit()
        db.refresh(rt)

        # Redirect to frontend with token and refresh token (refresh token shown once)
        redirect_url = (
            f"{FRONTEND_URL}/?token={access_token}&refresh_token={raw_refresh}"
        )
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        error_url = f"{FRONTEND_URL}/?error={str(e)}"
        return RedirectResponse(url=error_url)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information
    Requires valid JWT token in Authorization header
    """
    return current_user


@router.post("/logout")
async def logout(
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
