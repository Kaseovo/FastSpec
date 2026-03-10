"""
Tests for the /lint endpoints (POST /lint/{spec_id} and POST /lint).
"""

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from database import SessionLocal
from models import User, OpenAPISpec
from auth.dependencies import get_current_user

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
    user = User(
        email=f"lint_test_{id(session)}@example.com",
        provider="test",
        provider_user_id=f"uid_{id(session)}",
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

SPECTRAL_NO_ISSUES: list = []

SPECTRAL_WITH_ISSUES = [
    {
        "code": "operation-description",
        "message": "Operation must have a description",
        "severity": 1,  # warn
        "path": ["paths", "/users", "get"],
        "range": {
            "start": {"line": 12, "character": 4},
            "end": {"line": 12, "character": 10},
        },
    },
    {
        "code": "info-contact",
        "message": "Info object should contain `contact` object",
        "severity": 1,  # warn
        "path": ["info"],
        "range": {
            "start": {"line": 2, "character": 0},
            "end": {"line": 2, "character": 4},
        },
    },
]

# ── Helpers ──────────────────────────────────────────────────────────────────


def _mock_spectral(raw_results: list):
    """Return a mock for run_spectral that produces a parsed response."""
    # Build the same output that _parse_result() would produce
    from validation.spectral_linter import _parse_result

    parsed = _parse_result(raw_results)

    def _side_effect(spec_json, ruleset="spectral:oas", timeout=60):
        return parsed

    return _side_effect


# ── POST /lint (ad-hoc) ───────────────────────────────────────────────────────


def test_adhoc_lint_no_issues(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    with patch(
        "routers.lint.run_spectral", side_effect=_mock_spectral(SPECTRAL_NO_ISSUES)
    ):
        resp = client.post("/lint", json={"spec_json": VALID_SPEC})

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["score"] == 100
    assert data["summary"] == {"error": 0, "warn": 0, "info": 0, "hint": 0}
    assert data["results"] == []


def test_adhoc_lint_with_warnings(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    with patch(
        "routers.lint.run_spectral", side_effect=_mock_spectral(SPECTRAL_WITH_ISSUES)
    ):
        resp = client.post("/lint", json={"spec_json": VALID_SPEC})

    assert resp.status_code == 200, resp.text
    data = resp.json()
    # 2 warnings → penalty 2*3=6 → score 94
    assert data["score"] == 94
    assert data["summary"]["warn"] == 2
    assert len(data["results"]) == 2
    assert data["results"][0]["severity"] == "warn"
    assert data["results"][0]["code"] == "operation-description"


def test_adhoc_lint_custom_ruleset(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    captured_ruleset = {}

    def _capture(spec_json, ruleset="spectral:oas", timeout=60):
        captured_ruleset["ruleset"] = ruleset
        return {
            "score": 100,
            "summary": {"error": 0, "warn": 0, "info": 0, "hint": 0},
            "results": [],
        }

    with patch("routers.lint.run_spectral", side_effect=_capture):
        resp = client.post(
            "/lint",
            json={
                "spec_json": VALID_SPEC,
                "ruleset": "https://example.com/my-ruleset.yaml",
            },
        )

    assert resp.status_code == 200
    assert captured_ruleset["ruleset"] == "https://example.com/my-ruleset.yaml"


def test_adhoc_lint_unauthenticated():
    app.dependency_overrides.pop(get_current_user, None)
    resp = client.post("/lint", json={"spec_json": VALID_SPEC})
    assert resp.status_code == 401


def test_adhoc_lint_spectral_failure(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    with patch("routers.lint.run_spectral", side_effect=RuntimeError("CLI not found")):
        resp = client.post("/lint", json={"spec_json": VALID_SPEC})

    assert resp.status_code == 502
    assert "CLI not found" in resp.json()["detail"]


# ── POST /lint/{spec_id} ──────────────────────────────────────────────────────


def test_lint_by_spec_id(db_session):
    user = _make_user(db_session)
    spec = OpenAPISpec(
        name="my-spec",
        title="Test API",
        version="1.0.0",
        spec_json=json.dumps(VALID_SPEC),
        user_id=user.id,
    )
    db_session.add(spec)
    db_session.commit()
    db_session.refresh(spec)

    # Create a versioned snapshot
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

    with patch(
        "routers.lint.run_spectral", side_effect=_mock_spectral(SPECTRAL_NO_ISSUES)
    ):
        resp = client.post(f"/lint/{spec.id}?version=1.0.0")

    assert resp.status_code == 200
    assert resp.json()["score"] == 100


def test_lint_draft_for_spec(db_session):
    user = _make_user(db_session)
    spec = OpenAPISpec(
        name="draft-spec",
        title="Draft API",
        version="1.0.0",
        spec_json=json.dumps(VALID_SPEC),
        user_id=user.id,
    )
    db_session.add(spec)
    db_session.commit()
    db_session.refresh(spec)

    app.dependency_overrides[get_current_user] = lambda: user

    with patch(
        "routers.lint.run_spectral", side_effect=_mock_spectral(SPECTRAL_NO_ISSUES)
    ):
        resp = client.post(
            f"/lint/{spec.id}/lint-draft", json={"spec_json": VALID_SPEC}
        )

    assert resp.status_code == 200
    assert resp.json()["score"] == 100


def test_lint_by_spec_id_not_found(db_session):
    user = _make_user(db_session)
    app.dependency_overrides[get_current_user] = lambda: user

    with patch(
        "routers.lint.run_spectral", side_effect=_mock_spectral(SPECTRAL_NO_ISSUES)
    ):
        resp = client.post("/lint/99999999")

    assert resp.status_code == 404


def test_lint_by_spec_id_wrong_user(db_session):
    user_a = _make_user(db_session)
    user_b = _make_user(db_session)

    spec = OpenAPISpec(
        name="user-a-spec",
        title="API",
        version="1.0.0",
        spec_json=json.dumps(VALID_SPEC),
        user_id=user_a.id,
    )
    db_session.add(spec)
    db_session.commit()
    db_session.refresh(spec)

    # Authenticate as user_b — should not see user_a's spec
    app.dependency_overrides[get_current_user] = lambda: user_b

    resp = client.post(f"/lint/{spec.id}")
    assert resp.status_code == 404


# ── Score calculation ─────────────────────────────────────────────────────────


def test_score_calculation_floors_at_zero():
    from validation.spectral_linter import _parse_result

    # 11 errors × 10 = 110 penalty → score should be 0, not negative
    many_errors = [
        {"code": "err", "message": "e", "severity": 0, "path": [], "range": {}}
        for _ in range(11)
    ]
    result = _parse_result(many_errors)
    assert result["score"] == 0


def test_score_calculation_mixed():
    from validation.spectral_linter import _parse_result

    issues = [
        {
            "code": "e1",
            "message": "m",
            "severity": 0,
            "path": [],
            "range": {},
        },  # error -10
        {
            "code": "w1",
            "message": "m",
            "severity": 1,
            "path": [],
            "range": {},
        },  # warn  -3
        {
            "code": "i1",
            "message": "m",
            "severity": 2,
            "path": [],
            "range": {},
        },  # info  -1
        {
            "code": "h1",
            "message": "m",
            "severity": 3,
            "path": [],
            "range": {},
        },  # hint  -0
    ]
    result = _parse_result(issues)
    assert result["score"] == 100 - 10 - 3 - 1
    assert result["summary"] == {"error": 1, "warn": 1, "info": 1, "hint": 1}
