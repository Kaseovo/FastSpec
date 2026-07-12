"""
Integration tests for the /lint/ruleset endpoints and custom ruleset passthrough.

Tests:
  - GET  /lint/ruleset
  - PUT  /lint/ruleset
  - DELETE /lint/ruleset
  - Ruleset forwarded to LintService during ad-hoc lint
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database import SessionLocal
from main import app
from models import User
from tests.fakes import FakeSpectralClient
from validation.spectral_client import spectral_client_dependency

client = TestClient(app)

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

VALID_SPEC = {
    "openapi": "3.0.0",
    "info": {"title": "Test API", "version": "1.0.0"},
    "paths": {},
}

_user_counter = 0


@pytest.fixture(scope="function")
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def _clear_dependency_overrides():
    """Ensure dependency overrides are reset after every test to avoid bleed-through."""
    yield
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(spectral_client_dependency, None)


def _make_user(session: Session) -> User:
    global _user_counter
    _user_counter += 1
    user = User(
        email=f"ruleset_test_{_user_counter}@example.com",
        provider="test",
        provider_user_id=f"uid_rs_{_user_counter}",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


# ---------------------------------------------------------------------------
# GET /lint/ruleset
# ---------------------------------------------------------------------------


def test_get_ruleset_not_found(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    resp = client.get("/lint/ruleset")
    assert resp.status_code == 404


def test_get_ruleset_after_put(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    payload = {
        "rules": [
            {
                "name": "require-summary",
                "severity": "warn",
                "given": "$.paths[*][*]",
                "then_function": "truthy",
            }
        ]
    }
    client.put("/lint/ruleset", json=payload)

    resp = client.get("/lint/ruleset")
    assert resp.status_code == 200
    data = resp.json()
    assert data["rules"][0]["name"] == "require-summary"
    assert data["rules"][0]["severity"] == "warn"


# ---------------------------------------------------------------------------
# PUT /lint/ruleset
# ---------------------------------------------------------------------------


def test_put_ruleset_creates_new_with_structured_rules(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    payload = {
        "rules": [
            {
                "name": "require-summary",
                "severity": "warn",
                "given": "$.paths[*][*]",
                "then_function": "truthy",
            }
        ]
    }
    resp = client.put("/lint/ruleset", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["rules"]) == 1
    assert data["rules"][0]["name"] == "require-summary"
    assert data["raw_yaml"] is None


def test_put_ruleset_with_valid_raw_yaml(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    raw = "extends: spectral:oas\nrules:\n  info-contact: off\n"
    resp = client.put("/lint/ruleset", json={"raw_yaml": raw})
    assert resp.status_code == 200
    data = resp.json()
    assert data["raw_yaml"] == raw
    assert data["rules"] is None


def test_put_ruleset_invalid_yaml_returns_400(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    resp = client.put("/lint/ruleset", json={"raw_yaml": "key: [unclosed"})
    assert resp.status_code == 400
    assert "Invalid YAML" in resp.json()["detail"]


def test_put_ruleset_rejects_functions_dir():
    """Regression test: raw_yaml is written to a file the Spectral CLI
    executes against, so functionsDir (arbitrary JS from disk) must be
    rejected rather than silently written to disk."""
    user = _make_user(SessionLocal())
    app.dependency_overrides[get_current_user] = lambda: user

    raw = "extends: spectral:oas\nfunctionsDir: /tmp/evil\nrules: {}\n"
    resp = client.put("/lint/ruleset", json={"raw_yaml": raw})
    assert resp.status_code == 400
    assert "functionsDir" in resp.json()["detail"]


def test_put_ruleset_rejects_extends_url():
    """Regression test: `extends` pointing at an arbitrary URL is an SSRF
    vector (Spectral fetches it at lint time) and must be rejected."""
    user = _make_user(SessionLocal())
    app.dependency_overrides[get_current_user] = lambda: user

    raw = "extends: http://169.254.169.254/latest/meta-data/\nrules: {}\n"
    resp = client.put("/lint/ruleset", json={"raw_yaml": raw})
    assert resp.status_code == 400
    assert "extends" in resp.json()["detail"]


def test_put_ruleset_updates_existing(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    # First save
    client.put(
        "/lint/ruleset",
        json={
            "rules": [
                {
                    "name": "first-rule",
                    "severity": "warn",
                    "given": "$",
                    "then_function": "truthy",
                }
            ]
        },
    )

    # Second save replaces first
    resp = client.put(
        "/lint/ruleset",
        json={
            "rules": [
                {
                    "name": "second-rule",
                    "severity": "error",
                    "given": "$.info",
                    "then_function": "truthy",
                }
            ]
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    names = [r["name"] for r in data["rules"]]
    assert names == ["second-rule"]
    assert "first-rule" not in names


# ---------------------------------------------------------------------------
# DELETE /lint/ruleset
# ---------------------------------------------------------------------------


def test_delete_ruleset(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    client.put(
        "/lint/ruleset",
        json={
            "rules": [
                {
                    "name": "temp-rule",
                    "severity": "warn",
                    "given": "$",
                    "then_function": "truthy",
                }
            ]
        },
    )
    resp = client.delete("/lint/ruleset")
    assert resp.status_code == 204


def test_delete_ruleset_not_found(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    resp = client.delete("/lint/ruleset")
    assert resp.status_code == 404


def test_get_after_delete_returns_404(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    client.put(
        "/lint/ruleset",
        json={
            "rules": [
                {
                    "name": "will-be-deleted",
                    "severity": "warn",
                    "given": "$",
                    "then_function": "truthy",
                }
            ]
        },
    )
    client.delete("/lint/ruleset")

    resp = client.get("/lint/ruleset")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Ruleset forwarded to LintService during lint
# ---------------------------------------------------------------------------


def test_lint_adhoc_forwards_user_ruleset(db_session):
    """When a user has a saved ruleset, LintService passes it to SpectralClient."""
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    raw = "extends: spectral:oas\nrules:\n  info-contact: off\n"
    client.put("/lint/ruleset", json={"raw_yaml": raw})

    fake = FakeSpectralClient()
    app.dependency_overrides[spectral_client_dependency] = lambda: fake

    resp = client.post("/lint", json={"spec_json": VALID_SPEC})
    assert resp.status_code == 200
    # The ruleset YAML forwarded to the client must contain the user's override
    assert len(fake.calls) == 1
    _, ruleset_yaml = fake.calls[0]
    assert "info-contact" in ruleset_yaml


def test_lint_adhoc_no_ruleset_passes_baseline(db_session):
    """When a user has no saved ruleset, LintService passes the spectral:oas baseline."""
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    fake = FakeSpectralClient()
    app.dependency_overrides[spectral_client_dependency] = lambda: fake

    resp = client.post("/lint", json={"spec_json": VALID_SPEC})
    assert resp.status_code == 200
    assert len(fake.calls) == 1
    _, ruleset_yaml = fake.calls[0]
    assert ruleset_yaml == "extends: spectral:oas\n"


def test_lint_with_ruleset_that_overrides_default_rule(db_session):
    """
    Saving a raw_yaml ruleset that sets info-contact: off, then running lint,
    forwards the override to SpectralClient — confirming the full CRUD → lint path.
    """
    import yaml

    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    raw = "extends: spectral:oas\nrules:\n  info-contact: off\n"
    put_resp = client.put("/lint/ruleset", json={"raw_yaml": raw})
    assert put_resp.status_code == 200

    fake = FakeSpectralClient()
    app.dependency_overrides[spectral_client_dependency] = lambda: fake

    resp = client.post("/lint", json={"spec_json": VALID_SPEC})
    assert resp.status_code == 200

    _, ruleset_yaml = fake.calls[0]
    produced = yaml.safe_load(ruleset_yaml)
    # YAML 1.1 parses bare 'off' as boolean False
    assert produced["rules"]["info-contact"] is False
