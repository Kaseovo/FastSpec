import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, get_db
from models import User
from auth.dependencies import get_current_user

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
