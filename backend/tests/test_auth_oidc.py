"""
OIDC sign-in (AUTH_MODE=oidc): GET /auth/oidc/login → provider →
GET /auth/oidc/callback → 302 to the SPA with #token=… or #error=….

The provider is simulated with an httpx.MockTransport serving discovery,
JWKS and the token endpoint, so the real discovery/PKCE/JWT-verification code
runs end to end without network access.
"""

import base64
import hashlib
import json
import time
from urllib.parse import parse_qs, unquote, urlparse

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import auth.oidc as oidc_module
import routers.auth as auth_router
from config import settings
from database import Base, get_db
from main import app
from models import User

ISSUER = "https://idp.example.com"
CLIENT_ID = "fastspec-client"
CLIENT_SECRET = "s3cret"


def _new_key(kid: str):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = private.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    public_jwk.update({"kid": kid, "use": "sig", "alg": "RS256"})
    return pem, public_jwk


class FakeProvider:
    """Minimal OIDC provider. Tests tweak `claims`/`fail_token` per case."""

    def __init__(self, issuer: str = ISSUER):
        self.issuer = issuer
        self.discovery_issuer = issuer
        self.pem, jwk = _new_key("key-1")
        self.jwks = [jwk]
        self.kid = "key-1"
        self.claims: dict = {}
        self.nonce: str | None = None
        self.fail_token = False
        self.token_requests: list[dict] = []
        self.jwks_fetches = 0

    def rotate_key(self):
        self.pem, jwk = _new_key("key-2")
        self.jwks = [jwk]
        self.kid = "key-2"

    def mint(self, **overrides) -> str:
        claims = {
            "iss": self.issuer,
            "aud": CLIENT_ID,
            "sub": "user-123",
            "email": "alice@example.com",
            "email_verified": True,
            "name": "Alice",
            "nonce": self.nonce,
            "iat": int(time.time()) - 60,
            "exp": int(time.time()) + 3600,
        }
        claims.update(self.claims)
        claims.update(overrides)
        return jwt.encode(claims, self.pem, algorithm="RS256", headers={"kid": self.kid})

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url == f"{self.issuer}/.well-known/openid-configuration":
            return httpx.Response(
                200,
                json={
                    "issuer": self.discovery_issuer,
                    "authorization_endpoint": f"{self.issuer}/authorize",
                    "token_endpoint": f"{self.issuer}/token",
                    "jwks_uri": f"{self.issuer}/jwks",
                    "token_endpoint_auth_methods_supported": ["client_secret_basic"],
                    "id_token_signing_alg_values_supported": ["RS256"],
                },
            )
        if url == f"{self.issuer}/jwks":
            self.jwks_fetches += 1
            return httpx.Response(200, json={"keys": self.jwks})
        if url == f"{self.issuer}/token":
            form = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
            form["_authorization"] = request.headers.get("authorization")
            self.token_requests.append(form)
            if self.fail_token:
                return httpx.Response(400, json={"error": "invalid_grant"})
            return httpx.Response(200, json={"id_token": self.mint(), "access_token": "x"})
        return httpx.Response(404)


@pytest.fixture
def provider(monkeypatch):
    fake = FakeProvider()
    monkeypatch.setattr(
        oidc_module,
        "http_client",
        lambda: httpx.Client(transport=httpx.MockTransport(fake.handler)),
    )
    return fake


@pytest.fixture(autouse=True)
def oidc_mode(monkeypatch):
    monkeypatch.setattr(settings, "auth_mode", "oidc")
    monkeypatch.setattr(settings, "oidc_issuer", ISSUER)
    monkeypatch.setattr(settings, "oidc_client_id", CLIENT_ID)
    monkeypatch.setattr(settings, "oidc_client_secret", CLIENT_SECRET)
    monkeypatch.setattr(settings, "public_url", "http://testserver")
    auth_router._cached_oidc_client.cache_clear()
    yield
    auth_router._cached_oidc_client.cache_clear()


engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
client = TestClient(app)


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
    app.dependency_overrides[auth_router._oidc_callback_rate_limit] = lambda: None
    client.cookies.clear()
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(auth_router._oidc_callback_rate_limit, None)
    Base.metadata.drop_all(bind=engine)


def _start_login(provider: FakeProvider) -> dict:
    resp = client.get("/auth/oidc/login", follow_redirects=False)
    assert resp.status_code == 302
    params = {k: v[0] for k, v in parse_qs(urlparse(resp.headers["location"]).query).items()}
    provider.nonce = params["nonce"]
    return params


def _callback(state: str, code: str = "auth-code"):
    return client.get(
        "/auth/oidc/callback",
        params={"code": code, "state": state},
        follow_redirects=False,
    )


def _fragment(resp) -> dict:
    location = resp.headers["location"]
    assert location.startswith("/specs/auth/callback#"), location
    return {k: unquote(v[0]) for k, v in parse_qs(location.split("#", 1)[1]).items()}


def _sign_in(provider: FakeProvider) -> dict:
    params = _start_login(provider)
    return _fragment(_callback(params["state"]))


# ── Login redirect ────────────────────────────────────────────────────────────


def test_login_redirects_to_provider_with_pkce(provider):
    resp = client.get("/auth/oidc/login", follow_redirects=False)

    location = urlparse(resp.headers["location"])
    params = {k: v[0] for k, v in parse_qs(location.query).items()}
    assert f"{location.scheme}://{location.netloc}{location.path}" == f"{ISSUER}/authorize"
    assert params["client_id"] == CLIENT_ID
    assert params["redirect_uri"] == "http://testserver/auth/oidc/callback"
    assert params["response_type"] == "code"
    assert params["scope"] == "openid email profile"
    assert params["code_challenge_method"] == "S256"
    assert params["state"] and params["nonce"]
    assert auth_router.OAUTH_STATE_COOKIE in resp.cookies


def test_pkce_verifier_sent_to_token_endpoint_matches_challenge(provider):
    params = _start_login(provider)
    _callback(params["state"])

    verifier = provider.token_requests[0]["code_verifier"]
    expected = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
    assert expected.rstrip(b"=").decode() == params["code_challenge"]


def test_token_endpoint_uses_client_secret_basic(provider):
    params = _start_login(provider)
    _callback(params["state"])

    request = provider.token_requests[0]
    expected = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    assert request["_authorization"] == f"Basic {expected}"
    assert "client_secret" not in request
    assert request["redirect_uri"] == "http://testserver/auth/oidc/callback"


def test_discovery_issuer_mismatch_redirects_with_error(provider):
    provider.discovery_issuer = "https://evil.example.com"
    resp = client.get("/auth/oidc/login", follow_redirects=False)
    assert "error" in _fragment(resp)


# ── Callback: happy path ──────────────────────────────────────────────────────


def test_callback_issues_usable_token_and_creates_user(provider):
    fragment = _sign_in(provider)

    assert "token" in fragment
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {fragment['token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"

    db = TestSessionLocal()
    user = db.query(User).one()
    assert (user.provider, user.provider_user_id, user.name) == ("oidc", "user-123", "Alice")
    db.close()


def test_callback_clears_state_cookie(provider):
    params = _start_login(provider)
    resp = _callback(params["state"])
    assert 'fastspec_oauth_state=""' in resp.headers.get("set-cookie", "")


def test_second_sign_in_reuses_user_and_updates_profile(provider):
    _sign_in(provider)
    provider.claims = {"name": "Alice Renamed", "email": "alice@new.example.com"}
    client.cookies.clear()
    _sign_in(provider)

    db = TestSessionLocal()
    user = db.query(User).one()
    assert user.name == "Alice Renamed"
    assert user.email == "alice@new.example.com"
    db.close()


def test_google_issuer_matches_existing_google_accounts(provider, monkeypatch):
    """Accounts created by the pre-OIDC Google flow keep working."""
    google = FakeProvider(issuer="https://accounts.google.com")
    monkeypatch.setattr(
        oidc_module,
        "http_client",
        lambda: httpx.Client(transport=httpx.MockTransport(google.handler)),
    )
    monkeypatch.setattr(settings, "oidc_issuer", "https://accounts.google.com")
    auth_router._cached_oidc_client.cache_clear()

    db = TestSessionLocal()
    db.add(User(email="alice@example.com", provider="google", provider_user_id="user-123"))
    db.commit()
    db.close()

    fragment = _sign_in(google)

    assert "token" in fragment
    db = TestSessionLocal()
    assert db.query(User).count() == 1
    db.close()


def test_issuer_with_trailing_slash(provider, monkeypatch):
    """Authentik-style issuers end with "/"; tokens carry it verbatim."""
    slashed = FakeProvider(issuer=ISSUER)
    slashed.discovery_issuer = ISSUER + "/"
    slashed.claims = {"iss": ISSUER + "/"}
    monkeypatch.setattr(
        oidc_module,
        "http_client",
        lambda: httpx.Client(transport=httpx.MockTransport(slashed.handler)),
    )
    monkeypatch.setattr(settings, "oidc_issuer", ISSUER + "/")
    auth_router._cached_oidc_client.cache_clear()

    assert "token" in _sign_in(slashed)


def test_rotated_signing_key_is_fetched(provider):
    _sign_in(provider)
    fetches_before = provider.jwks_fetches
    provider.rotate_key()
    client.cookies.clear()

    fragment = _sign_in(provider)

    assert "token" in fragment
    assert provider.jwks_fetches == fetches_before + 1


# ── Callback: rejected tokens ─────────────────────────────────────────────────


@pytest.mark.parametrize(
    "overrides",
    [
        {"nonce": "wrong-nonce"},
        {"aud": "another-client"},
        {"iss": "https://evil.example.com"},
        {"exp": int(time.time()) - 3600},
    ],
    ids=["nonce", "audience", "issuer", "expired"],
)
def test_invalid_id_token_is_rejected(provider, overrides):
    provider.claims = overrides
    fragment = _sign_in(provider)
    assert "error" in fragment and "token" not in fragment


def test_hs256_token_signed_with_client_secret_is_rejected(provider, monkeypatch):
    """Algorithm confusion: an HS256 token must never be accepted."""
    params = _start_login(provider)
    forged = jwt.encode(
        {
            "iss": ISSUER,
            "aud": CLIENT_ID,
            "sub": "attacker",
            "email": "attacker@example.com",
            "nonce": provider.nonce,
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        },
        CLIENT_SECRET,
        algorithm="HS256",
    )
    monkeypatch.setattr(provider, "mint", lambda: forged)

    fragment = _fragment(_callback(params["state"]))

    assert "error" in fragment


def test_token_endpoint_failure_redirects_with_error(provider):
    provider.fail_token = True
    fragment = _sign_in(provider)
    assert "error" in fragment


# ── Callback: state / cookie handling ─────────────────────────────────────────


def test_callback_with_state_mismatch_is_rejected(provider):
    _start_login(provider)
    fragment = _fragment(_callback("not-the-state"))
    assert "mismatch" in fragment["error"]


def test_callback_without_cookie_is_rejected(provider):
    params = _start_login(provider)
    client.cookies.clear()
    fragment = _fragment(_callback(params["state"]))
    assert "error" in fragment


def test_callback_with_provider_error_is_rejected(provider):
    resp = client.get("/auth/oidc/callback", params={"error": "access_denied"}, follow_redirects=False)
    assert "access_denied" in _fragment(resp)["error"]


def test_callback_without_code_is_rejected(provider):
    resp = client.get("/auth/oidc/callback", follow_redirects=False)
    assert "error" in _fragment(resp)


# ── Account rules ─────────────────────────────────────────────────────────────


def test_unverified_email_is_rejected(provider):
    provider.claims = {"email_verified": False}
    assert "not verified" in _sign_in(provider)["error"]


def test_same_email_different_subject_does_not_take_over_account(provider):
    db = TestSessionLocal()
    db.add(User(email="alice@example.com", provider="oidc", provider_user_id="original-sub"))
    db.commit()
    db.close()
    provider.claims = {"sub": "attacker-sub"}

    fragment = _sign_in(provider)

    assert "already exists" in fragment["error"]


@pytest.mark.parametrize(
    "setting, value, email, verified, allowed",
    [
        ("allowed_email_domains", "example.com", "alice@example.com", True, True),
        ("allowed_email_domains", "@Example.com", "alice@EXAMPLE.com", True, True),
        ("allowed_email_domains", "example.com", "mallory@other.com", True, False),
        ("allowed_email_domains", "example.com", "alice@example.com", None, False),
        ("allowed_emails", "bob@other.com, alice@example.com", "alice@example.com", True, True),
        ("allowed_emails", "bob@other.com", "alice@example.com", True, False),
    ],
)
def test_allowlist(provider, monkeypatch, setting, value, email, verified, allowed):
    monkeypatch.setattr(settings, setting, value)
    provider.claims = {"email": email, "email_verified": verified}

    fragment = _sign_in(provider)

    assert ("token" in fragment) is allowed
    if not allowed:
        assert "not allowed" in fragment["error"]


# ── Mode gating ───────────────────────────────────────────────────────────────


def test_local_session_is_disabled_in_oidc_mode(provider):
    assert client.post("/auth/local/session").status_code == 404


def test_auth_config_describes_oidc(provider, monkeypatch):
    monkeypatch.setattr(settings, "oidc_provider_name", "Acme SSO")
    assert client.get("/auth/config").json() == {
        "mode": "oidc",
        "provider_name": "Acme SSO",
        "login_url": "/auth/oidc/login",
    }
