"""
Single-user mode (AUTH_MODE=none), startup config validation, and moving
the local user's data to a real account (docs/adr/0006-auth-modes.md).
"""

import stat
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth.users import (
    LOCAL_PROVIDER,
    get_or_create_local_user,
    transfer_local_data,
)
from base import Base
from config import JWT_SECRET_FILENAME, ConfigError, load_settings, settings
from database import get_db
from main import app
from models import APIKey, LintRuleset, OpenAPISpec, SpecVersion, User

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db(monkeypatch):
    monkeypatch.setattr(settings, "auth_mode", "none")
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


# ── AUTH_MODE=none ────────────────────────────────────────────────────────────


def test_auth_config_describes_none_mode():
    assert client.get("/auth/config").json() == {
        "mode": "none",
        "provider_name": None,
        "login_url": None,
    }


def test_local_session_issues_usable_token():
    resp = client.post("/auth/local/session")

    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["provider"] == LOCAL_PROVIDER
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["id"] == body["user"]["id"]


def test_local_session_always_returns_the_same_user():
    first = client.post("/auth/local/session").json()["user"]["id"]
    second = client.post("/auth/local/session").json()["user"]["id"]
    assert first == second


def test_oidc_routes_are_disabled_in_none_mode():
    assert client.get("/auth/oidc/login", follow_redirects=False).status_code == 404
    assert client.get("/auth/oidc/callback", follow_redirects=False).status_code == 404


# ── Startup config validation ────────────────────────────────────────────────

OIDC = {
    "OIDC_ISSUER": "https://idp.example.com",
    "OIDC_CLIENT_ID": "id",
    "OIDC_CLIENT_SECRET": "secret",
}


@pytest.fixture
def clean_env(monkeypatch):
    """Keep the developer's/CI's environment out of load_settings()."""
    for name in [
        "AUTH_MODE",
        "OIDC_ISSUER",
        "OIDC_CLIENT_ID",
        "OIDC_CLIENT_SECRET",
        "ALLOWED_EMAILS",
        "ALLOWED_EMAIL_DOMAINS",
        "FASTSPEC_DATA_DIR",
    ]:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 32)


def _load(**env):
    return load_settings(_env_file=None, **env)


def test_none_mode_is_the_default(clean_env):
    assert _load().auth_mode == "none"


def test_oidc_values_without_oidc_mode_refuse_to_start(clean_env):
    """Forgetting AUTH_MODE=oidc must never leave a server open to everyone."""
    with pytest.raises(ConfigError, match="AUTH_MODE is 'none'"):
        _load(OIDC_ISSUER="https://idp.example.com")


def test_allowlist_without_oidc_mode_refuses_to_start(clean_env):
    with pytest.raises(ConfigError, match="only apply when AUTH_MODE=oidc"):
        _load(ALLOWED_EMAIL_DOMAINS="example.com")


def test_oidc_mode_requires_all_provider_settings(clean_env):
    with pytest.raises(ConfigError, match="OIDC_CLIENT_SECRET"):
        _load(AUTH_MODE="oidc", OIDC_ISSUER="https://idp.example.com", OIDC_CLIENT_ID="id")


def test_complete_oidc_config_loads(clean_env):
    s = _load(AUTH_MODE="oidc", **OIDC)
    assert s.oidc_provider_key == "oidc"
    assert s.oidc_display_name == "SSO"


def test_google_issuer_uses_google_provider_key(clean_env):
    s = _load(AUTH_MODE="oidc", **{**OIDC, "OIDC_ISSUER": "https://accounts.google.com/"})
    assert s.oidc_provider_key == "google"
    assert s.oidc_display_name == "Google"


def test_redirect_uri_and_cors_derive_from_public_url(clean_env):
    s = _load(PUBLIC_URL="https://specs.example.com/")
    assert s.oidc_redirect_uri == "https://specs.example.com/auth/oidc/callback"
    assert s.cors_origins_list == ["https://specs.example.com"]


def test_missing_jwt_secret_without_data_dir_refuses_to_start(clean_env, monkeypatch):
    monkeypatch.delenv("JWT_SECRET_KEY")
    with pytest.raises(ConfigError, match="JWT_SECRET_KEY is required"):
        _load()


def test_jwt_secret_is_generated_once_and_persisted(clean_env, monkeypatch, tmp_path):
    monkeypatch.delenv("JWT_SECRET_KEY")

    first = _load(FASTSPEC_DATA_DIR=str(tmp_path)).jwt_secret_key
    second = _load(FASTSPEC_DATA_DIR=str(tmp_path)).jwt_secret_key

    secret_file = tmp_path / JWT_SECRET_FILENAME
    assert first == second == secret_file.read_text()
    assert len(first) == 64
    assert stat.S_IMODE(secret_file.stat().st_mode) == 0o600


# ── Transferring local data to a real account ────────────────────────────────


def _seed_local_data(db):
    local = get_or_create_local_user(db)
    target = User(email="alice@example.com", provider="oidc", provider_user_id="sub-1")
    db.add(target)
    db.flush()
    spec = OpenAPISpec(name="Petstore", version="1.0.0", user_id=local.id)
    db.add(spec)
    db.flush()
    db.add(SpecVersion(spec_id=spec.id, version="1.0.0", content={}, created_by=local.id))
    db.add(LintRuleset(user_id=local.id, name="Strict", is_default=True))
    db.add(LintRuleset(user_id=target.id, name="Strict", is_default=True))
    db.add(
        APIKey(
            token_hash="h",
            user_id=local.id,
            expires_at=datetime(2100, 1, 1),
        )
    )
    db.commit()
    return local, target


def test_transfer_moves_specs_and_rulesets_and_revokes_keys():
    db = TestSessionLocal()
    local, target = _seed_local_data(db)

    result = transfer_local_data(db, "alice@example.com")

    assert (result.specs, result.rulesets, result.revoked_api_keys) == (1, 1, 1)
    assert db.query(OpenAPISpec).one().user_id == target.id
    assert db.query(SpecVersion).one().created_by == target.id
    moved = db.query(LintRuleset).filter(LintRuleset.name == "Strict (local)").one()
    assert moved.user_id == target.id
    # The target keeps its own default ruleset.
    assert moved.is_default is False
    assert db.query(APIKey).one().revoked is True
    db.close()


def test_transfer_requires_the_target_to_have_signed_in():
    db = TestSessionLocal()
    get_or_create_local_user(db)
    with pytest.raises(ValueError, match="Sign in once"):
        transfer_local_data(db, "nobody@example.com")
    db.close()
