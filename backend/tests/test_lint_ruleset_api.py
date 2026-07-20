"""
Integration tests for the /lint/rulesets endpoints and custom ruleset passthrough.

Tests:
  - GET  /lint/rulesets
  - POST /lint/rulesets
  - GET  /lint/rulesets/{id}
  - PUT  /lint/rulesets/{id}
  - DELETE /lint/rulesets/{id}
  - POST /lint/rulesets/{id}/set-default
  - PUT  /lint/spec/{spec_id}/ruleset
  - Default ruleset forwarded to LintService during ad-hoc lint
  - POST /lint/preview-rule
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


def _create_ruleset(name="My Ruleset", **kwargs):
    payload = {"name": name, **kwargs}
    resp = client.post("/lint/rulesets", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# GET /lint/rulesets, POST /lint/rulesets
# ---------------------------------------------------------------------------


def test_list_rulesets_empty(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    resp = client.get("/lint/rulesets")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_ruleset_becomes_default(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    ruleset = _create_ruleset(
        name="Internal API",
        rules=[
            {
                "name": "require-summary",
                "severity": "warn",
                "given": "$.paths[*][*]",
                "then_function": "truthy",
            }
        ],
    )
    assert ruleset["is_default"] is True
    assert ruleset["rules"][0]["name"] == "require-summary"


def test_create_second_ruleset_is_not_default(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    _create_ruleset(name="First")
    second = _create_ruleset(name="Second")
    assert second["is_default"] is False


def test_create_ruleset_duplicate_name_conflicts(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    _create_ruleset(name="Dup")
    resp = client.post("/lint/rulesets", json={"name": "Dup"})
    assert resp.status_code == 409


def test_create_ruleset_requires_name(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    resp = client.post("/lint/rulesets", json={"name": "  "})
    assert resp.status_code == 400


def test_create_ruleset_rejects_functions_dir(db_session):
    """Regression test: raw_yaml is written to a file the Spectral CLI
    executes against, so functionsDir (arbitrary JS from disk) must be
    rejected rather than silently written to disk."""
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    raw = "extends: spectral:oas\nfunctionsDir: /tmp/evil\nrules: {}\n"
    resp = client.post("/lint/rulesets", json={"name": "Evil", "raw_yaml": raw})
    assert resp.status_code == 400
    assert "functionsDir" in resp.json()["detail"]


def test_create_ruleset_rejects_extends_url(db_session):
    """Regression test: `extends` pointing at an arbitrary URL is an SSRF
    vector (Spectral fetches it at lint time) and must be rejected."""
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    raw = "extends: http://169.254.169.254/latest/meta-data/\nrules: {}\n"
    resp = client.post("/lint/rulesets", json={"name": "SSRF", "raw_yaml": raw})
    assert resp.status_code == 400
    assert "extends" in resp.json()["detail"]


def test_list_rulesets_returns_summaries(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    _create_ruleset(name="A", rules=[{"name": "r1", "given": "$", "then_function": "truthy"}])
    _create_ruleset(name="B", raw_yaml="extends: spectral:oas\nrules: {}\n")

    resp = client.get("/lint/rulesets")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    by_name = {r["name"]: r for r in data}
    assert by_name["A"]["rule_count"] == 1
    assert by_name["A"]["is_default"] is True
    assert by_name["B"]["has_raw_yaml"] is True
    assert by_name["B"]["is_default"] is False


# ---------------------------------------------------------------------------
# GET/PUT /lint/rulesets/{id}
# ---------------------------------------------------------------------------


def test_get_ruleset_not_found(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    resp = client.get("/lint/rulesets/does-not-exist")
    assert resp.status_code == 404


def test_update_ruleset_rules(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    ruleset = _create_ruleset(
        name="Mutable",
        rules=[{"name": "first-rule", "given": "$", "then_function": "truthy"}],
    )

    resp = client.put(
        f"/lint/rulesets/{ruleset['id']}",
        json={"rules": [{"name": "second-rule", "given": "$.info", "then_function": "truthy"}]},
    )
    assert resp.status_code == 200
    data = resp.json()
    names = [r["name"] for r in data["rules"]]
    assert names == ["second-rule"]


def test_update_ruleset_rename_conflict(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    _create_ruleset(name="Taken")
    other = _create_ruleset(name="Other")

    resp = client.put(f"/lint/rulesets/{other['id']}", json={"name": "Taken"})
    assert resp.status_code == 409


def test_update_ruleset_invalid_yaml_returns_400(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    ruleset = _create_ruleset(name="Bad YAML target")
    resp = client.put(
        f"/lint/rulesets/{ruleset['id']}", json={"raw_yaml": "key: [unclosed"}
    )
    assert resp.status_code == 400
    assert "Invalid YAML" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# DELETE /lint/rulesets/{id}, set-default
# ---------------------------------------------------------------------------


def test_delete_only_ruleset(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    ruleset = _create_ruleset(name="Only one")
    resp = client.delete(f"/lint/rulesets/{ruleset['id']}")
    assert resp.status_code == 204


def test_delete_default_ruleset_blocked_when_others_exist(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    default_ruleset = _create_ruleset(name="Default")
    _create_ruleset(name="Other")

    resp = client.delete(f"/lint/rulesets/{default_ruleset['id']}")
    assert resp.status_code == 409


def test_set_default_then_delete_previous_default_succeeds(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    first = _create_ruleset(name="First")
    second = _create_ruleset(name="Second")

    resp = client.post(f"/lint/rulesets/{second['id']}/set-default")
    assert resp.status_code == 200
    assert resp.json()["is_default"] is True

    # First is no longer default, so it can now be deleted.
    resp = client.delete(f"/lint/rulesets/{first['id']}")
    assert resp.status_code == 204


def test_delete_ruleset_not_found(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    resp = client.delete("/lint/rulesets/does-not-exist")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Default ruleset forwarded to LintService during ad-hoc lint
# ---------------------------------------------------------------------------


def test_lint_adhoc_forwards_default_ruleset(db_session):
    """When a user has a default ruleset, LintService passes it to SpectralClient."""
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    _create_ruleset(
        name="Default", raw_yaml="extends: spectral:oas\nrules:\n  info-contact: off\n"
    )

    fake = FakeSpectralClient()
    app.dependency_overrides[spectral_client_dependency] = lambda: fake

    resp = client.post("/lint", json={"spec_json": VALID_SPEC})
    assert resp.status_code == 200
    assert len(fake.calls) == 1
    _, ruleset_yaml = fake.calls[0]
    assert "info-contact" in ruleset_yaml


def test_lint_adhoc_no_ruleset_passes_baseline(db_session):
    """When a user has no rulesets, LintService passes the spectral:oas baseline."""
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    fake = FakeSpectralClient()
    app.dependency_overrides[spectral_client_dependency] = lambda: fake

    resp = client.post("/lint", json={"spec_json": VALID_SPEC})
    assert resp.status_code == 200
    assert len(fake.calls) == 1
    _, ruleset_yaml = fake.calls[0]
    assert ruleset_yaml == "extends: spectral:oas\n"


# ---------------------------------------------------------------------------
# POST /lint/preview-rule
# ---------------------------------------------------------------------------


def test_preview_rule_calls_spectral_client_with_single_rule(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    fake = FakeSpectralClient()
    app.dependency_overrides[spectral_client_dependency] = lambda: fake

    resp = client.post(
        "/lint/preview-rule",
        json={
            "spec_json": VALID_SPEC,
            "rule": {
                "name": "preview-me",
                "severity": "error",
                "given": "$.info",
                "then_function": "truthy",
            },
        },
    )
    assert resp.status_code == 200
    assert len(fake.calls) == 1
    _, ruleset_yaml = fake.calls[0]
    assert "preview-me" in ruleset_yaml
    assert "spectral:oas" not in ruleset_yaml
