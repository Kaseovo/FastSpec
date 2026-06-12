"""
Authentication routes for OAuth2 and JWT
"""

import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

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
    create_short_jwt,
    create_api_key,
)
from auth.dependencies import get_current_user
from permissions import ALLOWED_ACTIONS, get_actions_metadata

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


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
async def list_available_actions():
    """Return all available actions that can be assigned to API keys."""
    return get_actions_metadata()


@router.post("/google/verify")
async def verify_google_token(
    payload: GoogleVerifyRequest, db: Session = Depends(get_db)
):
    """
    Verify a Google ID token (from the PKCE / GIS client-side flow) and
    return a FastSpec JWT.

    Accepts: { "id_token": "<Google ID token>" }
    Returns: { "access_token": "<FastSpec JWT>" }
    """
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")

    try:
        id_info = id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            google_client_id,
        )
    except Exception:
        raise HTTPException(
            status_code=401, detail="Invalid or expired Google ID token"
        )

    email = id_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    name = id_info.get("name")
    picture = id_info.get("picture")
    provider_user_id = id_info.get("sub")

    # Check if user exists
    user = (
        db.query(User)
        .filter(User.email == email, User.provider == "google")
        .first()
    )

    if user:
        # Update existing user
        user.name = name
        user.avatar_url = picture
        user.provider_user_id = provider_user_id
    else:
        # Create new user
        user = User(
            email=email,
            name=name,
            avatar_url=picture,
            provider="google",
            provider_user_id=provider_user_id,
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    # Generate FastSpec JWT
    access_token = create_access_token(user.id, user.email, db_session=db)

    return {"access_token": access_token}


# New endpoint: exchange api_key for a short JWT
@router.post("/refresh/exchange")
async def exchange_api_key(
    payload: ApiKeyExchangeRequest, db: Session = Depends(get_db)
):
    """Validate an API key string and return a short-lived JWT with actions."""
    api_key_raw = payload.api_key
    token_rec = find_api_key_by_raw(db, api_key_raw)
    now = datetime.now(timezone.utc)
    if not token_rec or token_rec.revoked or token_rec.expires_at < now:
        raise HTTPException(status_code=401, detail="Invalid or revoked api_key")

    # Issue short JWT with actions embedded
    actions = token_rec.get_actions()
    short_jwt, expires_at = create_short_jwt(token_rec.user_id, actions)

    # update last_used_at
    token_rec.last_used_at = now
    db.add(token_rec)
    db.commit()

    return {"access_token": short_jwt, "expires_at": expires_at}


# New endpoint: revoke an api_key (requires short JWT auth)
@router.post("/refresh/revoke")
async def revoke_api_key(
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


@router.get("/refresh")
async def list_api_keys(
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


@router.post("/refresh")
async def create_api_key_route(
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


@router.delete("/refresh/{id}")
async def refresh_api_key(
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


@router.put("/refresh/{id}/actions", response_model=ApiKeyActionsResponse)
async def update_api_key_actions(
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
