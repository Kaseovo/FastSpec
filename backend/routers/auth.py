"""
Authentication routes for OAuth2 and JWT
"""

import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from database import get_db
from models import User, CustomToken
from schemas import UserResponse
from auth.oauth import oauth, get_google_user_info, get_github_user_info
from auth.jwt import (
    create_access_token,
    create_custom_token,
    verify_custom_token,
    refresh_custom_token,
)
from auth.dependencies import get_current_user

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class TokenCreateRequest(BaseModel):
    actions: List[str]


class TokenIntrospectRequest(BaseModel):
    token: str


ALLOWED_ACTIONS = {"A", "B"}


@router.post("/auth/tokens", status_code=status.HTTP_201_CREATED)
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


@router.get("/auth/tokens")
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


@router.delete("/auth/tokens/{jti}")
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


@router.post("/auth/tokens/{jti}/refresh")
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


@router.post("/auth/tokens/introspect")
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


# existing oauth routes and callbacks (unchanged) ...


@router.get("/auth/google")
async def login_google(request: Request):
    """
    Initiate Google OAuth flow
    Redirects user to Google consent page
    """
    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI", f"{FRONTEND_URL}/auth/google/callback"
    )
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/auth/google/callback")
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

        # Generate JWT token
        access_token = create_access_token(user.id, user.email)

        # Redirect to frontend with token
        redirect_url = f"{FRONTEND_URL}/?token={access_token}"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        error_url = f"{FRONTEND_URL}/?error={str(e)}"
        return RedirectResponse(url=error_url)


@router.get("/auth/github")
async def login_github(request: Request):
    """
    Initiate GitHub OAuth flow
    Redirects user to GitHub authorization page
    """
    redirect_uri = os.getenv(
        "GITHUB_REDIRECT_URI", f"{FRONTEND_URL}/auth/github/callback"
    )
    return await oauth.github.authorize_redirect(request, redirect_uri)


@router.get("/auth/github/callback")
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

        # Generate JWT token
        access_token = create_access_token(user.id, user.email)

        # Redirect to frontend with token
        redirect_url = f"{FRONTEND_URL}/?token={access_token}"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        error_url = f"{FRONTEND_URL}/?error={str(e)}"
        return RedirectResponse(url=error_url)


@router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information
    Requires valid JWT token in Authorization header
    """
    return current_user


@router.post("/auth/logout")
async def logout():
    """
    Logout endpoint (client-side token removal)
    Token is stored on client side, so this is just a placeholder
    The actual logout happens when client removes the token
    """
    return {"message": "Logged out successfully"}
