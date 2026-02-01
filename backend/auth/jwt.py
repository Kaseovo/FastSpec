"""
JWT token utilities for authentication
"""

from datetime import datetime, timedelta
from typing import Optional
import os
from jose import JWTError, jwt
from fastapi import HTTPException, status
import uuid
import json
import secrets

# Hashing
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# JWT Configuration
JWT_SIGNING_KEY = os.getenv(
    "JWT_SIGNING_KEY",
    os.getenv("JWT_SECRET_KEY", "your-super-secret-jwt-key-change-in-production"),
)
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "3600"))
REFRESH_TOKEN_TTL_DAYS = int(os.getenv("REFRESH_TOKEN_TTL_DAYS", "30"))
SHORT_JWT_TTL_SECONDS = int(os.getenv("SHORT_JWT_TTL_SECONDS", "300"))

from models import CustomToken, User, AuthToken, RefreshToken


def create_access_token(user_id: int, email: str, db_session=None) -> str:
    """
    Create a JWT access token for a user
    """
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    now = datetime.utcnow()
    jti = uuid.uuid4().hex
    to_encode = {
        "sub": str(user_id),
        "email": email,
        "jti": jti,
        "exp": expire,
        "iat": now,
    }
    encoded_jwt = jwt.encode(to_encode, JWT_SIGNING_KEY, algorithm=ALGORITHM)

    # Persist token if db_session provided
    if db_session is not None:
        try:
            expires_at = expire
            token_rec = AuthToken(
                jti=jti,
                user_id=user_id,
                token=encoded_jwt,
                expires_at=expires_at,
            )
            db_session.add(token_rec)
            db_session.commit()
            db_session.refresh(token_rec)
        except Exception:
            # Don't fail token creation if DB persistence fails; log in real app
            pass

    return encoded_jwt


def verify_token(token: str) -> dict:
    """
    Verify and decode a JWT token
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, JWT_SIGNING_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        jti: str = payload.get("jti")

        if user_id is None or email is None:
            raise credentials_exception

        result = {"user_id": int(user_id), "email": email}
        if jti:
            result["jti"] = jti
        return result

    except JWTError:
        raise credentials_exception


# --- Custom short-lived token lifecycle (existing custom tokens) ---


SHORT_LIVED_JWT_EXP_SECONDS = SHORT_JWT_TTL_SECONDS


def create_custom_token(
    db_session, user: User, actions: list[str]
) -> (str, str, datetime):
    """Create and store a short-lived custom JWT for specific actions.

    Returns (token_str, jti, expires_at)
    """
    now = datetime.utcnow()
    jti = uuid.uuid4().hex
    expires_at = now + timedelta(seconds=SHORT_LIVED_JWT_EXP_SECONDS)

    token_rec = CustomToken(
        user_id=user.id,
        jti=jti,
        expires_at=expires_at,
        session_version=user.session_version,
    )
    token_rec.set_actions(actions)
    db_session.add(token_rec)
    db_session.commit()
    db_session.refresh(token_rec)

    payload = {
        "sub": str(user.id),
        "jti": jti,
        "actions": actions,
        "session_version": user.session_version,
        "exp": expires_at,
        "iat": now,
    }
    token_str = jwt.encode(payload, JWT_SIGNING_KEY, algorithm=ALGORITHM)
    return token_str, jti, expires_at


def verify_custom_token(db_session, token_str: str):
    """Verify custom token signature and DB state; return payload dict or raise HTTPException"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token_str, JWT_SIGNING_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise credentials_exception

    jti = payload.get("jti")
    sub = payload.get("sub")
    token_session_version = payload.get("session_version")

    if not jti or not sub:
        raise credentials_exception

    token_rec = db_session.query(CustomToken).filter(CustomToken.jti == jti).first()
    now = datetime.utcnow()
    if not token_rec or token_rec.revoked or token_rec.expires_at < now:
        raise credentials_exception

    user = db_session.query(User).filter(User.id == int(sub)).first()
    if not user:
        raise credentials_exception

    if token_rec.session_version != user.session_version:
        # session version mismatch -> fast revocation
        raise credentials_exception

    return {
        "user_id": int(sub),
        "actions": token_rec.get_actions(),
        "expires_at": token_rec.expires_at,
        "jti": jti,
    }


def refresh_custom_token(db_session, user: User, jti: str) -> (str, datetime):
    """Refresh an existing custom token's expiry and issue a new JWT string."""
    token_rec = (
        db_session.query(CustomToken)
        .filter(CustomToken.jti == jti, CustomToken.user_id == user.id)
        .first()
    )
    if not token_rec or token_rec.revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Token not found"
        )

    now = datetime.utcnow()
    new_expires = now + timedelta(seconds=SHORT_LIVED_JWT_EXP_SECONDS)
    token_rec.expires_at = new_expires
    db_session.add(token_rec)
    db_session.commit()
    db_session.refresh(token_rec)

    payload = {
        "sub": str(user.id),
        "jti": jti,
        "actions": token_rec.get_actions(),
        "session_version": token_rec.session_version,
        "exp": new_expires,
        "iat": now,
    }
    token_str = jwt.encode(payload, JWT_SIGNING_KEY, algorithm=ALGORITHM)
    return token_str, new_expires


# --- New: Refresh token generation and short JWT helpers ---


def generate_refresh_token() -> str:
    """Generate a secure random refresh token (plaintext returned once)."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_refresh_token_raw(raw: str, token_hash: str) -> bool:
    return pwd_context.verify(raw, token_hash)


def create_refresh_token(
    db_session, user: User, actions: list[str]
) -> (str, RefreshToken, datetime):
    """Create and persist a new RefreshToken for the given user.

    Returns (raw_token_plaintext, refresh_token_record, expires_at)
    """
    now = datetime.utcnow()
    raw = generate_refresh_token()
    hashed = hash_refresh_token(raw)
    expires_at = now + timedelta(days=REFRESH_TOKEN_TTL_DAYS)

    rt = RefreshToken(
        token_hash=hashed,
        user_id=user.id,
        actions=json.dumps(actions or []),
        expires_at=expires_at,
    )
    db_session.add(rt)
    db_session.commit()
    db_session.refresh(rt)
    return raw, rt, expires_at


def create_short_jwt(user_id: int, actions: list[str]) -> (str, datetime):
    """Create a short-lived JWT containing the provided actions and token_type="short"."""
    now = datetime.utcnow()
    exp = now + timedelta(seconds=SHORT_JWT_TTL_SECONDS)
    payload = {
        "sub": str(user_id),
        "actions": actions,
        "token_type": "short",
        "exp": exp,
        "iat": now,
    }
    token = jwt.encode(payload, JWT_SIGNING_KEY, algorithm=ALGORITHM)
    return token, exp


def verify_short_jwt(token: str) -> dict:
    """Verify a short JWT and ensure token_type=="short"."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired short token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SIGNING_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise credentials_exception

    if payload.get("token_type") != "short":
        raise credentials_exception
    sub = payload.get("sub")
    if not sub:
        raise credentials_exception
    return payload


# Helper: find refresh token by raw value


def find_refresh_token_by_raw(db_session, raw: str) -> Optional[RefreshToken]:
    # Since we store only hashes, we must check all non-revoked non-expired tokens for the user
    now = datetime.utcnow()
    candidates = (
        db_session.query(RefreshToken)
        .filter(RefreshToken.revoked == False, RefreshToken.expires_at >= now)
        .all()
    )
    for rec in candidates:
        try:
            if verify_refresh_token_raw(raw, rec.token_hash):
                return rec
        except Exception:
            continue
    return None
