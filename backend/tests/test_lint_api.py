"""
Integration tests for the /lint router endpoints.

Uses FakeSpectralClient injected via FastAPI dependency_overrides so that
no real Spectral process is invoked.

Score calculation tests have been moved to test_spectral_linter.py.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database import SessionLocal
from main import app
from models import OpenAPISpec, User
from tests.fakes import FakeSpectralClient
from validation.spectral_client import spectral_client_dependency

client = TestClient(app)

# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture(scope="function")
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _make_user(session: Session) -> User:
    import uuid as _uuid

    uid = _uuid.uuid4().hex
    user = User(
        email=f"lint_test_{uid}@example.com",
        provider="test",
        provider_user_id=f"uid_{uid}",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


VALID_SPEC = {
    "openapi": "3.0.0",
    "info": {"title": "Test API", "version": "1.0.0"},
    "paths": {},
}


def _override_spectral(fake: FakeSpectralClient):
    """Override spectral_client_dependency dependency with *fake*."""
    app.dependency_overrides[spectral_client_dependency] = lambda: fake


def _clear_spectral_override():
    app.dependency_overrides.pop(spectral_client_dependency, None)


# ── POST /lint (ad-hoc) ───────────────────────────────────────────────────────


def test_adhoc_lint_no_issues(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user
    _override_spectral(FakeSpectralClient(score=100))

    try:
        resp = client.post("/lint", json={"spec_json": VALID_SPEC})
    finally:
        _clear_spectral_override()

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["score"] == 100
    assert data["summary"] == {"error": 0, "warn": 0, "info": 0, "hint": 0}
    assert data["results"] == []


def test_adhoc_lint_with_warnings(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user
    _override_spectral(
        FakeSpectralClient(
            score=94,
            summary={"error": 0, "warn": 2, "info": 0, "hint": 0},
            results=[
                {
                    "code": "operation-description",
                    "message": "Operation must have a description",
                    "severity": "warn",
                    "path": ["paths", "/users", "get"],
                    "range": {},
                },
                {
                    "code": "info-contact",
                    "message": "Info object should contain `contact` object",
                    "severity": "warn",
                    "path": ["info"],
                    "range": {},
                },
            ],
        )
    )

    try:
        resp = client.post("/lint", json={"spec_json": VALID_SPEC})
    finally:
        _clear_spectral_override()

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["score"] == 94
    assert data["summary"]["warn"] == 2
    assert len(data["results"]) == 2
    assert data["results"][0]["severity"] == "warn"
    assert data["results"][0]["code"] == "operation-description"


def test_adhoc_lint_unauthenticated():
    app.dependency_overrides.pop(get_current_user, None)
    resp = client.post("/lint", json={"spec_json": VALID_SPEC})
    assert resp.status_code in (401, 403)


def test_adhoc_lint_spectral_failure(db_session):

    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user
    _override_spectral(FakeSpectralClient(raise_error="CLI not found"))

    try:
        resp = client.post("/lint", json={"spec_json": VALID_SPEC})
    finally:
        _clear_spectral_override()

    assert resp.status_code == 502
    assert "CLI not found" in resp.json()["detail"]


# ── POST /lint/{spec_id} ──────────────────────────────────────────────────────


def test_lint_by_spec_id(db_session):
    user = _make_user(db_session)
    spec = OpenAPISpec(name="my-spec", version="1.0.0", user_id=user.id)
    db_session.add(spec)
    db_session.commit()
    db_session.refresh(spec)

    from models import SpecVersion

    spec_version = SpecVersion(
        spec_id=spec.id,
        version="1.0.0",
        content=VALID_SPEC,
        created_by=user.id,
    )
    db_session.add(spec_version)
    db_session.commit()

    app.dependency_overrides[get_current_user] = lambda: user
    _override_spectral(FakeSpectralClient(score=100))

    try:
        resp = client.post(f"/lint/{spec.id}?version=1.0.0")
    finally:
        _clear_spectral_override()

    assert resp.status_code == 200
    assert resp.json()["score"] == 100


def test_lint_draft_for_spec(db_session):
    user = _make_user(db_session)
    spec = OpenAPISpec(name="draft-spec", version="1.0.0", user_id=user.id)
    db_session.add(spec)
    db_session.commit()
    db_session.refresh(spec)

    app.dependency_overrides[get_current_user] = lambda: user
    _override_spectral(FakeSpectralClient(score=100))

    try:
        resp = client.post(
            f"/lint/{spec.id}/lint-draft", json={"spec_json": VALID_SPEC}
        )
    finally:
        _clear_spectral_override()

    assert resp.status_code == 200
    assert resp.json()["score"] == 100


def test_lint_by_spec_id_not_found(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    # Missing required version param → 422; spec lookup with version → 404
    resp = client.post("/lint/99999999?version=1.0.0")
    assert resp.status_code == 404


def test_lint_by_spec_id_wrong_user(db_session):
    import uuid as _uuid

    user_a = _make_user(db_session)
    uid_b = _uuid.uuid4().hex
    user_b = User(
        email=f"lint_b_{uid_b}@example.com",
        provider="test",
        provider_user_id=f"uid_b_{uid_b}",
    )
    db_session.add(user_b)
    db_session.commit()
    db_session.refresh(user_b)

    spec = OpenAPISpec(name="user-a-spec", version="1.0.0", user_id=user_a.id)
    db_session.add(spec)
    db_session.commit()
    db_session.refresh(spec)

    # Authenticate as user_b — should not see user_a's spec
    app.dependency_overrides[get_current_user] = lambda: user_b

    resp = client.post(f"/lint/{spec.id}?version=1.0.0")
    assert resp.status_code == 404
