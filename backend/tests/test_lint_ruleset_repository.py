"""
Unit tests for LintRulesetRepository covering two race/error-handling fixes:

  1. create()'s "first ruleset becomes default" check-then-insert is now
     serialized per-user, so two near-simultaneous creates for a brand-new
     user can't both become default.
  2. delete() translates a raced IntegrityError (a spec pinned to the
     ruleset in the gap between the pinned-spec check and the commit) into
     the same 409 the check itself would have produced, instead of a raw 500.
"""

import threading

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from base import Base
from database import SessionLocal
from models import User
from services.lint_ruleset_repository import LintRulesetRepository

_user_counter = 0


@pytest.fixture
def threaded_sessions(tmp_path):
    """Sessions with a connection each, on a database file. The shared
    in-memory test database is a single connection (StaticPool), which two
    threads can't use at once — sqlite3 may crash the test run."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'race.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False)
    engine.dispose()


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
        email=f"ruleset_repo_test_{_user_counter}@example.com",
        provider="test",
        provider_user_id=f"uid_rr_{_user_counter}",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


# ---------------------------------------------------------------------------
# create(): default-assignment race
# ---------------------------------------------------------------------------


def test_first_ruleset_becomes_default():
    session = SessionLocal()
    try:
        user = _make_user(session)
        repo = LintRulesetRepository(session)
        ruleset = repo.create(user.id, "First", None, None)
        assert ruleset.is_default is True
    finally:
        session.close()


def test_second_ruleset_does_not_become_default():
    session = SessionLocal()
    try:
        user = _make_user(session)
        repo = LintRulesetRepository(session)
        repo.create(user.id, "First", None, None)
        second = repo.create(user.id, "Second", None, None)
        assert second.is_default is False
    finally:
        session.close()


def test_concurrent_first_creates_for_a_new_user_yield_exactly_one_default(threaded_sessions):
    """Two threads racing to create a brand-new user's very first ruleset
    must not both win "is_default" -- see create()'s per-user lock."""
    user_id_holder = {}
    session = threaded_sessions()
    try:
        user = _make_user(session)
        user_id_holder["id"] = user.id
    finally:
        session.close()
    user_id = user_id_holder["id"]

    start_barrier = threading.Barrier(2)
    errors = []

    def _create(name: str):
        session = threaded_sessions()
        try:
            repo = LintRulesetRepository(session)
            start_barrier.wait(timeout=5)
            repo.create(user_id, name, None, None)
        except Exception as exc:  # pragma: no cover - surfaced via errors list
            errors.append(exc)
        finally:
            session.close()

    t1 = threading.Thread(target=_create, args=("Ruleset A",))
    t2 = threading.Thread(target=_create, args=("Ruleset B",))
    t1.start()
    t2.start()
    t1.join(timeout=5)
    t2.join(timeout=5)

    assert not errors, f"unexpected errors from concurrent create(): {errors}"

    verify_session = threaded_sessions()
    try:
        repo = LintRulesetRepository(verify_session)
        rulesets = repo.list(user_id)
        assert len(rulesets) == 2
        defaults = [r for r in rulesets if r.is_default]
        assert len(defaults) == 1, (
            f"expected exactly one default, got {len(defaults)}: "
            f"{[(r.name, r.is_default) for r in rulesets]}"
        )
    finally:
        verify_session.close()


# ---------------------------------------------------------------------------
# delete(): raced pinned-spec IntegrityError -> 409, not 500
# ---------------------------------------------------------------------------


def test_delete_translates_integrity_error_into_409(monkeypatch):
    session = SessionLocal()
    try:
        user = _make_user(session)
        repo = LintRulesetRepository(session)
        ruleset = repo.create(user.id, "Pinned elsewhere mid-flight", None, None)

        def _raise_integrity_error():
            raise IntegrityError("statement", "params", Exception("FK violation"))

        monkeypatch.setattr(session, "commit", _raise_integrity_error)
        rollback_calls = []
        monkeypatch.setattr(
            session, "rollback", lambda: rollback_calls.append(True)
        )

        with pytest.raises(HTTPException) as exc_info:
            repo.delete(user.id, ruleset.id)

        assert exc_info.value.status_code == 409
        assert rollback_calls, "delete() must roll back after a raced IntegrityError"
    finally:
        session.close()
