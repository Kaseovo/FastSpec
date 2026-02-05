"""
FastAPI dependencies for authentication
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import User, AuthToken
from .jwt import verify_token
from auth.redis_client import redis_client
from datetime import datetime

# Security scheme for Swagger UI
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Get the current authenticated user from JWT token

    Args:
        credentials: HTTP Authorization header with Bearer token
        db: Database session

    Returns:
        User object

    Raises:
        HTTPException: If token is invalid or user not found
    """
    token = credentials.credentials

    # Try Redis cache for short JWTs
    key = f"short_jwt:{token}"
    try:
        cached_user_id = redis_client.get(key)
    except Exception:
        cached_user_id = None

    if cached_user_id:
        try:
            user_id = int(cached_user_id)
        except Exception:
            user_id = None
        if user_id is not None:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                return user

    # Verify and decode token
    token_data = verify_token(token)

    # Ensure token exists in DB and is not revoked/expired
    jti = token_data.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token (missing jti)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_rec = (
        db.query(AuthToken)
        .filter(AuthToken.jti == jti, AuthToken.revoked == False)
        .first()
    )

    if not token_rec or token_rec.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token revoked or expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # If short token, cache user id in Redis to speed up subsequent auth
    try:
        if token_data.get("token_type") == "short":
            exp = token_data.get("exp")
            ttl = None
            if exp is not None:
                try:
                    if isinstance(exp, (int, float)):
                        ttl = int(int(exp) - datetime.utcnow().timestamp())
                    else:
                        # assume datetime-like
                        ttl = int((exp - datetime.utcnow()).total_seconds())
                except Exception:
                    ttl = None
            if ttl and ttl > 0:
                try:
                    redis_client.setex(key, ttl, str(token_data["user_id"]))
                except Exception:
                    # Don't let Redis failures block authentication
                    pass
    except Exception:
        # Defensive: any unexpected error should not block authentication
        pass

    # Get user from database
    user = db.query(User).filter(User.id == token_data["user_id"]).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Get the current active user (can be extended with additional checks)

    Args:
        current_user: Current authenticated user

    Returns:
        User object
    """
    # Can add additional checks here (e.g., user is_active flag)
    return current_user
