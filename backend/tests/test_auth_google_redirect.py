"""
Tests for the Google OAuth redirect flow:
GET /auth/google/login  → 302 to Google's consent screen + state cookie
GET /auth/google/callback → validates state, exchanges the code, and
redirects to the log-in page with #token=… (or #error=… on failure).

Google's token endpoint and ID-token verification are patched at the
boundary — no network access.
"""

from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, get_db
from models import User
from routers.auth import OAUTH_STATE_COOKIE

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

client = TestClient(app)

MOCK_ID_INFO = {
    "email": "bob@example.com",
    "name": "Bob Example",
    "picture": "https://example.com/bob.jpg",
    "sub": "google_uid_bob_456",
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
    client.cookies.clear()
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)


class _FakeTokenResponse:
    """Stands in for httpx.Response from Google's token endpoint."""

    def __init__(self, payload: dict, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


class _FakeAsyncClient:
    """Stands in for httpx.AsyncClient in routers.auth."""

    def __init__(self, response: _FakeTokenResponse):
        self._response = response

    def __call__(self, *args, **kwargs):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, *args, **kwargs):
        return self._response


def _fragment_params(location: str) -> dict:
    """Parse the #fragment of a redirect Location into a dict."""
    fragment = urlparse(location).fragment
    return {k: v[0] for k, v in parse_qs(fragment).items()}


def _start_login() -> str:
    """Hit /google/login and return the state Google would echo back."""
    resp = client.get("/auth/google/login", follow_redirects=False)
    assert resp.status_code == 302
    query = parse_qs(urlparse(resp.headers["location"]).query)
    return query["state"][0]


# ---------------------------------------------------------------------------
# /google/login
# ---------------------------------------------------------------------------


def test_login_redirects_to_google_with_expected_params():
    resp = client.get("/auth/google/login", follow_redirects=False)
    assert resp.status_code == 302

    location = urlparse(resp.headers["location"])
    assert location.hostname == "accounts.google.com"

    query = parse_qs(location.query)
    assert query["response_type"] == ["code"]
    assert query["client_id"] == ["test-google-client-id"]
    assert query["redirect_uri"] == ["http://testserver/auth/google/callback"]
    assert "openid" in query["scope"][0]
    assert query["state"][0]


def test_login_sets_state_cookie_matching_state_param():
    resp = client.get("/auth/google/login", follow_redirects=False)
    state = parse_qs(urlparse(resp.headers["location"]).query)["state"][0]
    assert resp.cookies.get(OAUTH_STATE_COOKIE) == state


# ---------------------------------------------------------------------------
# /google/callback — failure paths all land on the log-in page with #error
# ---------------------------------------------------------------------------


def test_callback_with_provider_error_redirects_with_error():
    resp = client.get(
        "/auth/google/callback?error=access_denied", follow_redirects=False
    )
    assert resp.status_code == 302
    assert _fragment_params(resp.headers["location"])["error"] == "access_denied"


def test_callback_without_code_redirects_with_error():
    resp = client.get("/auth/google/callback", follow_redirects=False)
    assert resp.status_code == 302
    assert "error" in _fragment_params(resp.headers["location"])


def test_callback_with_state_mismatch_redirects_with_error():
    _start_login()  # sets the state cookie on the client
    resp = client.get(
        "/auth/google/callback?code=authcode&state=forged-state",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "error" in _fragment_params(resp.headers["location"])


def test_callback_without_cookie_redirects_with_error():
    state = _start_login()
    client.cookies.clear()  # browser lost the cookie (or CSRF attempt)
    resp = client.get(
        f"/auth/google/callback?code=authcode&state={state}",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "error" in _fragment_params(resp.headers["location"])


def test_callback_token_exchange_failure_redirects_with_error():
    state = _start_login()
    failing = _FakeAsyncClient(_FakeTokenResponse({}, status_code=400))
    with patch("routers.auth.httpx.AsyncClient", failing):
        resp = client.get(
            f"/auth/google/callback?code=badcode&state={state}",
            follow_redirects=False,
        )
    assert resp.status_code == 302
    assert "error" in _fragment_params(resp.headers["location"])


# ---------------------------------------------------------------------------
# /google/callback — happy path
# ---------------------------------------------------------------------------


def _successful_callback() -> dict:
    state = _start_login()
    ok = _FakeAsyncClient(_FakeTokenResponse({"id_token": "google.id.token"}))
    with patch("routers.auth.httpx.AsyncClient", ok), patch(
        "routers.auth.id_token.verify_oauth2_token", return_value=MOCK_ID_INFO
    ):
        resp = client.get(
            f"/auth/google/callback?code=authcode&state={state}",
            follow_redirects=False,
        )
    assert resp.status_code == 302
    return _fragment_params(resp.headers["location"])


def test_callback_happy_path_redirects_with_token():
    params = _successful_callback()
    assert "error" not in params
    assert params["token"]


def test_callback_happy_path_creates_user():
    _successful_callback()
    db = TestSessionLocal()
    try:
        user = (
            db.query(User)
            .filter(User.email == MOCK_ID_INFO["email"], User.provider == "google")
            .first()
        )
        assert user is not None
        assert user.provider_user_id == MOCK_ID_INFO["sub"]
    finally:
        db.close()


def test_callback_token_is_usable_against_auth_me():
    params = _successful_callback()
    resp = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {params['token']}"}
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == MOCK_ID_INFO["email"]
