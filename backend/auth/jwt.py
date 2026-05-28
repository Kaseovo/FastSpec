"""
JWT token utilities for authentication
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from config import JWT_SECRET_KEY, JWT_ALGORITHM
import os
from jose import JWTError, jwt
from fastapi import HTTPException, status
import uuid
import json
import secrets
from database import SessionLocal
from models import User, AuthToken, APIKey

# Hashing
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# JWT Configuration
def _int_env(key: str, default: str) -> int:
    return int(os.getenv(key, default).split("#")[0].strip())


ACCESS_TOKEN_EXPIRE_MINUTES = _int_env("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "3600")
API_KEY_TTL_DAYS = _int_env("API_KEY_TTL_DAYS", "30")
SHORT_JWT_TTL_SECONDS = _int_env("SHORT_JWT_TTL_SECONDS", "300")


def create_access_token(user_id: int, email: str, db_session=None) -> str:
    """
    Create a JWT access token for a user
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    now = datetime.now(timezone.utc)
    jti = uuid.uuid4().hex
    to_encode = {
        "sub": str(user_id),
        "email": email,
        "jti": jti,
        "exp": expire,
        "iat": now,
    }
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

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
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
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


# --- API key generation and short JWT helpers ---


def generate_api_key() -> str:
    """Generate a secure random api_key (plaintext returned once)."""
    return secrets.token_urlsafe(48)


def hash_api_key(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_api_key_raw(raw: str, token_hash: str) -> bool:
    return pwd_context.verify(raw, token_hash)


def create_api_key(
    db_session, user: User, actions: list[str]
) -> tuple[str, APIKey, datetime]:
    """Create and persist a new API key (stored as a hashed APIKey record).

    Returns (raw_api_key_plaintext, api_key_record, expires_at)
    """
    now = datetime.now(timezone.utc)
    raw = generate_api_key()
    hashed = hash_api_key(raw)
    expires_at = now + timedelta(days=API_KEY_TTL_DAYS)
    # deterministic non-secret prefix for fast lookup
    prefix = raw[:12]

    rt = APIKey(
        key_prefix=prefix,
        token_hash=hashed,
        user_id=user.id,
        actions=json.dumps(actions or []),
        expires_at=expires_at,
    )
    db_session.add(rt)
    db_session.commit()
    db_session.refresh(rt)
    return raw, rt, expires_at


def create_short_jwt(user_id: int, actions: list[str]) -> tuple[str, datetime]:
    """Create a short-lived JWT containing the provided actions and token_type="short"."""
    now = datetime.now(timezone.utc)
    exp = now + timedelta(seconds=SHORT_JWT_TTL_SECONDS)
    payload = {
        "sub": str(user_id),
        "actions": actions,
        "token_type": "short",
        "exp": exp,
        "iat": now,
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, exp


def verify_short_jwt(token: str) -> dict:
    """Verify a short JWT and ensure token_type=="short"."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired short token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise credentials_exception

    if payload.get("token_type") != "short":
        raise credentials_exception
    sub = payload.get("sub")
    if not sub:
        raise credentials_exception
    return payload


# Helper: find API key by raw value


def find_api_key_by_raw(db_session, raw: str) -> Optional[APIKey]:
    """Find API key by raw plaintext value.

    Fast path: use key_prefix (first 12 chars) to find candidate and run a single
    hash verification. Fall back to scanning rows with NULL key_prefix for
    pre-migration keys.
    """
    now = datetime.now(timezone.utc)
    prefix = raw[:12]

    # Primary fast-path: lookup by prefix
    candidate = (
        db_session.query(APIKey)
        .filter(
            APIKey.key_prefix == prefix,
            APIKey.revoked == False,
            APIKey.expires_at >= now,
        )
        .first()
    )
    if candidate:
        try:
            if verify_api_key_raw(raw, candidate.token_hash):
                return candidate
        except Exception:
            pass

    # Fallback for pre-migration rows where key_prefix is NULL: scan only those
    candidates_null_prefix = (
        db_session.query(APIKey)
        .filter(
            APIKey.key_prefix == None,
            APIKey.revoked == False,
            APIKey.expires_at >= now,
        )
        .all()
    )
    for rec in candidates_null_prefix:
        try:
            if verify_api_key_raw(raw, rec.token_hash):
                return rec
        except Exception:
            continue
    return None


def exchange_api_key_for_short_jwt(api_key: str) -> tuple[str, datetime]:
    """Validate an API key string and return a short-lived JWT with actions."""
    db = SessionLocal()
    try:
        token_rec = find_api_key_by_raw(db, api_key)
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

        return short_jwt, expires_at
    finally:
        db.close()
