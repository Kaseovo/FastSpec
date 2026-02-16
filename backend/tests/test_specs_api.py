import json
import pytest
from fastapi.testclient import TestClient

from main import app
from database import SessionLocal
from models import User, OpenAPISpec, SpecVersion
from auth.dependencies import get_current_user

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _create_user(session):
    user = User(email="test@example.com", provider="test", provider_user_id="uid")
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def test_update_spec_with_matching_version_creates_new_version(db_session):
    # Setup user and spec with published version
    user = _create_user(db_session)

    spec = OpenAPISpec(
        name="spec1",
        title="Spec 1",
        version="1.0.0",
        spec_json=json.dumps({"info": {"version": "1.0.0"}, "paths": {}}),
        user_id=user.id,
    )
    db_session.add(spec)
    db_session.commit()
    db_session.refresh(spec)

    ver = SpecVersion(
        spec_id=spec.id,
        version="1.0.0",
        content={"info": {"version": "1.0.0"}},
        created_by=user.id,
        is_published=True,
    )
    db_session.add(ver)
    db_session.commit()

    # Override auth dependency to return our user
    app.dependency_overrides[get_current_user] = lambda: user

    # Perform update with matching base version
    payload = {
        "version": "1.0.0",
        "spec_json": {"info": {"version": "1.0.1"}, "paths": {}},
    }
    resp = client.put(f"/specs/{spec.id}", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["version"] == "1.0.1"

    # New version entry should exist
    new_ver = (
        db_session.query(SpecVersion)
        .filter(SpecVersion.spec_id == spec.id, SpecVersion.version == "1.0.1")
        .first()
    )
    assert new_ver is not None


def test_update_spec_with_conflicting_version_returns_409(db_session):
    user = _create_user(db_session)

    spec = OpenAPISpec(
        name="spec2",
        title="Spec 2",
        version="2.0.0",
        spec_json=json.dumps({"info": {"version": "2.0.0"}, "paths": {}}),
        user_id=user.id,
    )
    db_session.add(spec)
    db_session.commit()
    db_session.refresh(spec)

    # Create a published version that is different
    ver = SpecVersion(
        spec_id=spec.id,
        version="2.0.0",
        content={"info": {"version": "2.0.0"}},
        created_by=user.id,
        is_published=True,
    )
    db_session.add(ver)
    db_session.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    # Provide an out-of-date version
    payload = {"version": "1.9.0", "spec_json": {"info": {"version": "2.0.1"}}}
    resp = client.put(f"/specs/{spec.id}", json=payload)
    assert resp.status_code == 409
    body = resp.json()
    assert body.get("message") == "Version conflict" or "Version conflict" in str(body)

    # Cleanup override
    app.dependency_overrides.pop(get_current_user, None)
