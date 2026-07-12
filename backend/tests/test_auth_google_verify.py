"""
Tests for POST /auth/google/verify endpoint.

Patches google.oauth2.id_token.verify_oauth2_token at the boundary so
tests never need a real Google token or network access.
"""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, get_db
from models import User

# In-memory SQLite, single connection shared across all operations in a test
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

client = TestClient(app)

MOCK_ID_INFO = {
    "email": "alice@example.com",
    "name": "Alice Example",
    "picture": "https://example.com/avatar.jpg",
    "sub": "google_uid_alice_123",
}


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        session = TestSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_verify_returns_access_token():
    """Happy path: valid Google ID token returns a FastSpec JWT."""
    with patch(
        "routers.auth.id_token.verify_oauth2_token", return_value=MOCK_ID_INFO
    ):
        resp = client.post(
            "/auth/google/verify", json={"id_token": "valid.google.token"}
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert isinstance(data["access_token"], str)
    assert len(data["access_token"]) > 0


# ---------------------------------------------------------------------------
# New-user creation
# ---------------------------------------------------------------------------


def test_new_user_is_created_on_first_sign_in():
    """A brand-new user is persisted to the database on first sign-in."""
    with patch(
        "routers.auth.id_token.verify_oauth2_token", return_value=MOCK_ID_INFO
    ):
        resp = client.post(
            "/auth/google/verify", json={"id_token": "valid.google.token"}
        )
    assert resp.status_code == 200

    db = TestSessionLocal()
    try:
        user = (
            db.query(User)
            .filter(User.email == MOCK_ID_INFO["email"], User.provider == "google")
            .first()
        )
        assert user is not None
        assert user.name == MOCK_ID_INFO["name"]
        assert user.provider == "google"
        assert user.provider_user_id == MOCK_ID_INFO["sub"]
        assert user.avatar_url == MOCK_ID_INFO["picture"]
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Existing-user update
# ---------------------------------------------------------------------------


def test_existing_user_fields_are_updated():
    """Profile fields (name, avatar_url, provider_user_id) are refreshed."""
    # Seed a pre-existing user with stale data
    db = TestSessionLocal()
    try:
        existing = User(
            email=MOCK_ID_INFO["email"],
            name="Old Name",
            avatar_url="https://old-avatar.example.com/img.jpg",
            provider="google",
            provider_user_id="old_sub_999",
        )
        db.add(existing)
        db.commit()
    finally:
        db.close()

    updated_info = {
        **MOCK_ID_INFO,
        "name": "Alice Updated",
        "picture": "https://new-avatar.example.com/img.jpg",
    }

    with patch(
        "routers.auth.id_token.verify_oauth2_token", return_value=updated_info
    ):
        resp = client.post(
            "/auth/google/verify", json={"id_token": "valid.google.token"}
        )
    assert resp.status_code == 200

    db = TestSessionLocal()
    try:
        user = (
            db.query(User)
            .filter(User.email == MOCK_ID_INFO["email"], User.provider == "google")
            .first()
        )
        assert user.name == "Alice Updated"
        assert user.avatar_url == "https://new-avatar.example.com/img.jpg"
        assert user.provider_user_id == MOCK_ID_INFO["sub"]
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Invalid / expired token → 401
# ---------------------------------------------------------------------------


def test_invalid_token_returns_401():
    """Returns 401 when google.oauth2.id_token raises (invalid/expired token)."""
    with patch(
        "routers.auth.id_token.verify_oauth2_token",
        side_effect=ValueError("Token signature is invalid"),
    ):
        resp = client.post(
            "/auth/google/verify", json={"id_token": "bad.token.value"}
        )
    assert resp.status_code == 401
    detail = resp.json().get("detail", "")
    assert "invalid" in detail.lower() or "expired" in detail.lower()


def test_expired_token_returns_401():
    """Returns 401 when token verification raises any exception."""
    with patch(
        "routers.auth.id_token.verify_oauth2_token",
        side_effect=Exception("Token expired"),
    ):
        resp = client.post(
            "/auth/google/verify", json={"id_token": "expired.token"}
        )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Missing required field → 422
# ---------------------------------------------------------------------------


def test_missing_id_token_field_returns_422():
    """Returns 422 when the id_token field is absent from the request body."""
    resp = client.post("/auth/google/verify", json={})
    assert resp.status_code == 422


def test_empty_body_returns_422():
    """Returns 422 when the request body is empty."""
    resp = client.post(
        "/auth/google/verify",
        content=b"",
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Redirect-flow routes exist (see test_auth_google_redirect.py for behavior)
# ---------------------------------------------------------------------------


def test_google_login_route_exists():
    """GET /auth/google/login starts the redirect flow (302 to Google)."""
    resp = client.get("/auth/google/login", follow_redirects=False)
    assert resp.status_code == 302


def test_google_callback_route_exists():
    """GET /auth/google/callback redirects to the log-in page (never 404s)."""
    resp = client.get("/auth/google/callback", follow_redirects=False)
    assert resp.status_code == 302
