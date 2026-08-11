"""
Tests for short-JWT revocation propagation and MCP per-request auth caching.

Covers two fixes:
  1. verify_short_jwt(token, db_session=...) re-checks the originating
     APIKey's revoked/expiry status instead of trusting signature+exp alone,
     and get_short_jwt_from_request() actually reuses a previously-issued
     short JWT (instead of always re-deriving one from a raw API key), which
     is what makes that revocation check reachable in practice.
  2. get_current_user() reuses AuthenticationMiddleware's per-request cached
     user (via fastmcp's get_context()) instead of re-running the full
     API-key exchange a second time.
"""

import pytest
from sqlalchemy.orm import Session

from auth.jwt import (
    create_api_key,
    create_short_jwt,
    exchange_api_key_for_short_jwt,
    verify_short_jwt,
)
from database import SessionLocal
from models import User
from fastmcp_server import authentication as auth_mod

_user_counter = 0


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _make_user(session: Session) -> User:
    global _user_counter
    _user_counter += 1
    user = User(
        email=f"short_jwt_test_{_user_counter}@example.com",
        provider="test",
        provider_user_id=f"uid_sj_{_user_counter}",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


# ---------------------------------------------------------------------------
# verify_short_jwt: revocation propagation
# ---------------------------------------------------------------------------


def test_verify_short_jwt_accepts_token_from_active_key(db_session):
    user = _make_user(db_session)
    raw, api_key, _ = create_api_key(db_session, user, ["read:specs"])

    short_jwt, _ = exchange_api_key_for_short_jwt(raw, db_session=db_session)

    payload = verify_short_jwt(short_jwt, db_session=db_session)
    assert payload["sub"] == str(user.id)
    assert payload["api_key_id"] == api_key.id


def test_verify_short_jwt_rejects_token_after_key_is_revoked(db_session):
    user = _make_user(db_session)
    raw, api_key, _ = create_api_key(db_session, user, ["read:specs"])
    short_jwt, _ = exchange_api_key_for_short_jwt(raw, db_session=db_session)

    # Token is valid immediately after exchange...
    verify_short_jwt(short_jwt, db_session=db_session)

    # ...but revoking the underlying key must invalidate it, even though the
    # JWT's own signature and exp claim are untouched.
    api_key.revoked = True
    db_session.add(api_key)
    db_session.commit()

    with pytest.raises(Exception):
        verify_short_jwt(short_jwt, db_session=db_session)


def test_verify_short_jwt_without_db_session_skips_revocation_check(db_session):
    """Documented behavior: omitting db_session is signature/exp-only (used
    right after minting, where the caller just checked the key itself)."""
    user = _make_user(db_session)
    raw, api_key, _ = create_api_key(db_session, user, ["read:specs"])
    short_jwt, _ = exchange_api_key_for_short_jwt(raw, db_session=db_session)

    api_key.revoked = True
    db_session.add(api_key)
    db_session.commit()

    # No db_session passed -> no DB round-trip -> revocation isn't checked.
    payload = verify_short_jwt(short_jwt)
    assert payload["sub"] == str(user.id)


def test_create_short_jwt_without_api_key_id_is_still_valid(db_session):
    """A short JWT minted with no api_key_id (api_key_id=None) must still
    verify fine when a db_session is passed -- there's nothing to check."""
    token, _ = create_short_jwt(user_id=1, actions=["read:specs"])
    payload = verify_short_jwt(token, db_session=db_session)
    assert payload["sub"] == "1"


# ---------------------------------------------------------------------------
# get_short_jwt_from_request: reuse path + revocation on reuse
# ---------------------------------------------------------------------------


class _FakeRequest:
    def __init__(self, bearer: str):
        self.headers = {"authorization": f"Bearer {bearer}"}


def test_get_short_jwt_from_request_reuses_a_valid_short_jwt(monkeypatch, db_session):
    user = _make_user(db_session)
    raw, api_key, _ = create_api_key(db_session, user, ["read:specs"])
    short_jwt, _ = exchange_api_key_for_short_jwt(raw, db_session=db_session)

    monkeypatch.setattr(auth_mod, "get_http_request", lambda: _FakeRequest(short_jwt))

    calls = {"exchange": 0}
    real_exchange = auth_mod.exchange_api_key_for_short_jwt

    def _counting_exchange(*args, **kwargs):
        calls["exchange"] += 1
        return real_exchange(*args, **kwargs)

    monkeypatch.setattr(auth_mod, "exchange_api_key_for_short_jwt", _counting_exchange)

    result = auth_mod.get_short_jwt_from_request()

    assert result == short_jwt
    # Reused directly -- no fresh API-key exchange (no extra DB/pbkdf2 work).
    assert calls["exchange"] == 0


def test_get_short_jwt_from_request_falls_back_to_raw_api_key(monkeypatch, db_session):
    user = _make_user(db_session)
    raw, api_key, _ = create_api_key(db_session, user, ["read:specs"])

    monkeypatch.setattr(auth_mod, "get_http_request", lambda: _FakeRequest(raw))

    result = auth_mod.get_short_jwt_from_request()

    payload = verify_short_jwt(result, db_session=db_session)
    assert payload["sub"] == str(user.id)


def test_get_short_jwt_from_request_rejects_reused_token_after_revocation(
    monkeypatch, db_session
):
    user = _make_user(db_session)
    raw, api_key, _ = create_api_key(db_session, user, ["read:specs"])
    short_jwt, _ = exchange_api_key_for_short_jwt(raw, db_session=db_session)

    api_key.revoked = True
    db_session.add(api_key)
    db_session.commit()

    monkeypatch.setattr(auth_mod, "get_http_request", lambda: _FakeRequest(short_jwt))

    with pytest.raises(PermissionError):
        auth_mod.get_short_jwt_from_request()


# ---------------------------------------------------------------------------
# get_current_user: reuse of AuthenticationMiddleware's per-request cache
# ---------------------------------------------------------------------------


class _FakeContextWithUser:
    def __init__(self, user):
        self.extra = {"user": user}


def test_get_current_user_reuses_middleware_cached_user(monkeypatch):
    cached_user = auth_mod.TokenPayload(
        sub="42", actions=["read:specs"], token_type="short", exp=0, iat=0
    )
    monkeypatch.setattr(
        auth_mod, "get_context", lambda: _FakeContextWithUser(cached_user)
    )

    def _boom():
        raise AssertionError(
            "get_short_jwt_from_request should not be called when a "
            "context-cached user is available"
        )

    monkeypatch.setattr(auth_mod, "get_short_jwt_from_request", _boom)

    result = auth_mod.get_current_user()
    assert result is cached_user


def test_get_current_user_falls_back_without_active_context(monkeypatch):
    def _no_context():
        raise RuntimeError("No active context found.")

    monkeypatch.setattr(auth_mod, "get_context", _no_context)

    token, _ = create_short_jwt(user_id=7, actions=["read:specs"])
    monkeypatch.setattr(
        auth_mod, "get_short_jwt_from_request", lambda: token
    )

    result = auth_mod.get_current_user()
    assert result.sub == "7"
