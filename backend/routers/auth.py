"""
Authentication routes for OAuth2 and JWT
"""

import os
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import Token, UserResponse
from ..auth.oauth import oauth, get_google_user_info, get_github_user_info
from ..auth.jwt import create_access_token
from ..auth.dependencies import get_current_user

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


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
        redirect_url = f"{FRONTEND_URL}/auth/callback?token={access_token}"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        error_url = f"{FRONTEND_URL}/auth/callback?error={str(e)}"
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
        redirect_url = f"{FRONTEND_URL}/auth/callback?token={access_token}"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        error_url = f"{FRONTEND_URL}/auth/callback?error={str(e)}"
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
