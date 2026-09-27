import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth.dependencies import get_current_user
from base import Base
from database import get_db
from main import app
from models import User

# In-memory SQLite for tests — StaticPool ensures all connections share the
# same database so tables created in setup_db are visible to every session.
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
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def _auth_as(user):
    app.dependency_overrides[get_current_user] = lambda: user


def test_create_spec_creates_and_persists():
    user = User(id=1, email="test@example.com", provider="test", provider_user_id="uid")
    _auth_as(user)
    payload = {
        "name": "spec-init",
        "spec_json": {
            "info": {"title": "My API", "version": "3.0.0"},
            "openapi": "3.0.0",
            "paths": {},
        },
    }
    resp = client.post("/specs?version=3.0.0", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == "spec-init"
    assert data["version"] == "3.0.0"


def test_update_spec_name():
    user = User(id=1, email="test@example.com", provider="test", provider_user_id="uid")
    _auth_as(user)
    # Create a spec
    payload = {
        "name": "spec1",
        "spec_json": {
            "info": {"title": "API", "version": "1.0.0"},
            "openapi": "3.0.0",
            "paths": {},
        },
    }
    resp = client.post("/specs?version=1.0.0", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    spec_id = data["id"]

    # Update name
    resp = client.put(f"/specs/{spec_id}", json={"name": "renamed", "version": "1.0.0"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "renamed"


def test_user_isolation():
    user1 = User(id=1, email="u1@example.com", provider="test", provider_user_id="uid1")
    user2 = User(id=2, email="u2@example.com", provider="test", provider_user_id="uid2")

    # User1 creates a spec
    _auth_as(user1)
    payload = {
        "name": "spec-u1",
        "spec_json": {
            "info": {"title": "U1", "version": "1.0.0"},
            "openapi": "3.0.0",
            "paths": {},
        },
    }
    resp = client.post("/specs?version=1.0.0", json=payload)
    assert resp.status_code == 201
    spec_id = resp.json()["id"]

    # User2 should not see it
    _auth_as(user2)
    resp = client.get("/specs")
    assert resp.status_code == 200
    assert len(resp.json()) == 0

    # User2 should not access it directly
    resp = client.get(f"/specs/{spec_id}")
    assert resp.status_code == 404


def _create_spec_with_versions(name="versioned-spec"):
    """Create a spec at version 1.0.0, then add a 2.0.0 version. Returns spec_id."""
    payload = {
        "name": name,
        "spec_json": {
            "info": {"title": "API", "version": "1.0.0"},
            "openapi": "3.0.0",
            "paths": {},
        },
    }
    resp = client.post("/specs?version=1.0.0", json=payload)
    assert resp.status_code == 201, resp.text
    spec_id = resp.json()["id"]

    resp = client.post(
        f"/specs/{spec_id}/versions",
        json={
            "version": "2.0.0",
            "content": {
                "info": {"title": "API", "version": "2.0.0"},
                "openapi": "3.0.0",
                "paths": {},
            },
        },
    )
    assert resp.status_code == 201, resp.text
    return spec_id


def test_delete_version_persists_across_requests():
    """Regression test for docs/history/2026-07-code-review.md bug #1: delete_version must
    actually commit, not just mutate an in-memory session that gets rolled
    back when the request's DB session closes."""
    user = User(id=1, email="test@example.com", provider="test", provider_user_id="uid")
    _auth_as(user)
    spec_id = _create_spec_with_versions()

    # 2.0.0 is the current live version and must not be deletable...
    resp = client.delete(f"/specs/{spec_id}/versions/2.0.0")
    assert resp.status_code == 403

    # ...but the older, non-live 1.0.0 version can be deleted, and the
    # deletion must survive a brand-new request (new DB session).
    resp = client.delete(f"/specs/{spec_id}/versions/1.0.0")
    assert resp.status_code == 204

    resp = client.get(f"/specs/{spec_id}/versions/1.0.0")
    assert resp.status_code == 404

    resp = client.get(f"/specs/{spec_id}/versions")
    assert resp.status_code == 200
    versions = [v["version"] for v in resp.json()]
    assert versions == ["2.0.0"]


def test_publish_version_persists_across_requests():
    """Regression test for docs/history/2026-07-code-review.md bug #2: publish_version must
    actually commit the spec's updated current-version pointer."""
    user = User(id=1, email="test@example.com", provider="test", provider_user_id="uid")
    _auth_as(user)
    spec_id = _create_spec_with_versions()

    # Publish 1.0.0 back as the live version.
    resp = client.post(f"/specs/{spec_id}/versions/1.0.0/publish")
    assert resp.status_code == 200
    assert resp.json()["version"] == "1.0.0"

    # A brand-new request (new DB session) must see the updated pointer.
    resp = client.get(f"/specs/{spec_id}")
    assert resp.status_code == 200
    assert resp.json()["version"] == "1.0.0"


def test_create_version_conflict_returns_409():
    user = User(id=1, email="test@example.com", provider="test", provider_user_id="uid")
    _auth_as(user)
    spec_id = _create_spec_with_versions()

    resp = client.post(
        f"/specs/{spec_id}/versions",
        json={
            "version": "2.0.0",
            "content": {"info": {"title": "API", "version": "2.0.0"}, "openapi": "3.0.0", "paths": {}},
        },
    )
    assert resp.status_code == 409


def test_update_spec_version_mismatch_returns_409():
    """Optimistic concurrency: OpenAPISpecUpdate.version must match the
    spec's current version or the update is rejected."""
    user = User(id=1, email="test@example.com", provider="test", provider_user_id="uid")
    _auth_as(user)
    spec_id = _create_spec_with_versions()

    resp = client.put(f"/specs/{spec_id}", json={"name": "renamed", "version": "1.0.0"})
    assert resp.status_code == 409


def test_create_spec_duplicate_name_returns_409():
    user = User(id=1, email="test@example.com", provider="test", provider_user_id="uid")
    _auth_as(user)
    _create_spec_with_versions(name="dup-name")

    payload = {
        "name": "dup-name",
        "spec_json": {
            "info": {"title": "API", "version": "1.0.0"},
            "openapi": "3.0.0",
            "paths": {},
        },
    }
    resp = client.post("/specs?version=1.0.0", json=payload)
    assert resp.status_code == 409


def _versioned_spec():
    """A spec at 1.0.0 (GET /pets) with a 1.1.0 that adds GET /owners."""
    user = User(id=1, email="test@example.com", provider="test", provider_user_id="uid")
    _auth_as(user)
    base = {"openapi": "3.0.3", "info": {"title": "Pets", "version": "1.0.0"}, "paths": {"/pets": {"get": {"responses": {"200": {"description": "ok"}}}}}}
    created = client.post("/specs/", json={"name": "pets", "version": "1.0.0", "spec_json": base}).json()
    newer = {**base, "paths": {**base["paths"], "/owners": {"get": {"responses": {"200": {"description": "ok"}}}}}}
    client.post(f"/specs/{created['id']}/versions", json={"version": "1.1.0", "content": newer})
    return created["id"], newer


def _paths(entries):
    return [(e["method"], e["path"]) for e in entries]


def test_compare_reports_changes_from_base_to_compare():
    """Regression: the diff was inverted — additions showed up as removals."""
    spec_id, _ = _versioned_spec()

    diff = client.post(f"/specs/{spec_id}/compare", json={"base": "1.0.0", "compare": "1.1.0"}).json()["diff"]

    assert _paths(diff["added"]) == [("get", "/owners")]
    assert diff["removed"] == []


def test_compare_draft_reports_what_the_draft_adds():
    spec_id, newer = _versioned_spec()
    draft = {**newer, "paths": {**newer["paths"], "/stores": {"get": {"responses": {"200": {"description": "ok"}}}}}}

    diff = client.post(f"/specs/{spec_id}/compare", json={"base": "1.1.0", "compare_content": draft}).json()["diff"]

    assert _paths(diff["added"]) == [("get", "/stores")]
    assert diff["removed"] == []
