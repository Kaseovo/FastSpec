"""
Unit tests for LintService — ADR-0004.

These tests exercise lint orchestration in isolation using FakeSpectralClient.
No running Spectral process and no real database are required.
"""

import uuid

import pytest
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User, UserLintRuleset
from services.lint_service import LintService
from tests.fakes import FakeSpectralClient
from validation.spectral_client import SpectralError


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _make_user(session: Session) -> User:
    uid = uuid.uuid4().hex
    user = User(
        email=f"lint_svc_{uid}@example.com",
        provider="test",
        provider_user_id=f"uid_svc_{uid}",
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


# ── Tests ─────────────────────────────────────────────────────────────────────


def test_lint_returns_score_from_client(db_session):
    user = _make_user(db_session)
    fake = FakeSpectralClient(score=85, summary={"error": 0, "warn": 5, "info": 0, "hint": 0})
    result = LintService(db_session, fake).lint(VALID_SPEC, user.id)
    assert result.score == 85
    assert result.summary.warn == 5


def test_lint_calls_client_with_spec_json(db_session):
    user = _make_user(db_session)
    fake = FakeSpectralClient()
    LintService(db_session, fake).lint(VALID_SPEC, user.id)
    assert len(fake.calls) == 1
    called_spec, _ = fake.calls[0]
    assert called_spec == VALID_SPEC


def test_lint_uses_default_ruleset_when_no_user_ruleset(db_session):
    user = _make_user(db_session)
    fake = FakeSpectralClient()
    LintService(db_session, fake).lint(VALID_SPEC, user.id)
    _, ruleset_yaml = fake.calls[0]
    assert "spectral:oas" in ruleset_yaml


def test_lint_uses_user_ruleset_when_present(db_session):
    import uuid

    user = _make_user(db_session)
    ruleset_row = UserLintRuleset(
        id=str(uuid.uuid4()),
        user_id=user.id,
        rules_json=None,
        raw_yaml="extends: spectral:oas\nrules:\n  my-rule:\n    severity: error\n",
    )
    db_session.add(ruleset_row)
    db_session.commit()

    fake = FakeSpectralClient()
    LintService(db_session, fake).lint(VALID_SPEC, user.id)
    _, ruleset_yaml = fake.calls[0]
    assert "my-rule" in ruleset_yaml


def test_lint_propagates_spectral_error(db_session):
    user = _make_user(db_session)
    fake = FakeSpectralClient(raise_error="sidecar unavailable")
    with pytest.raises(SpectralError, match="sidecar unavailable"):
        LintService(db_session, fake).lint(VALID_SPEC, user.id)


def test_lint_no_issues_score_100(db_session):
    user = _make_user(db_session)
    fake = FakeSpectralClient(score=100)
    result = LintService(db_session, fake).lint(VALID_SPEC, user.id)
    assert result.score == 100
    assert result.results == []
