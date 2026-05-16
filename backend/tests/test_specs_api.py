import json
import pytest
from fastapi.testclient import TestClient
import fakeredis
from unittest.mock import patch

from main import app
from backend.auth.redis_client import get_redis
from schemas import OpenAPISpecCreate, OpenAPISpecUpdate
from models import User
from auth.dependencies import get_current_user

client = TestClient(app)


@patch("backend.auth.redis_client.get_redis")
def test_create_spec_creates_and_persists(mock_get_redis):
    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    mock_get_redis.return_value = fake_redis
    user = User(id=1, email="test@example.com", provider="test", provider_user_id="uid")
    app.dependency_overrides[get_current_user] = lambda: user
    payload = {
        "name": "spec-init",
        "spec_json": {"info": {"version": "3.0.0"}, "paths": {}},
    }
    resp = client.post("/specs?version=3.0.0", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == "spec-init"
    assert data["version"] == "3.0.0"
    # Check Redis for persistence
    keys = fake_redis.smembers("specs:1")
    assert data["id"] in keys
    stored = fake_redis.get(f"spec:1:{data['id']}")
    assert stored is not None


@patch("backend.auth.redis_client.get_redis")
def test_update_spec_name(mock_get_redis):
    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    mock_get_redis.return_value = fake_redis
    user = User(id=1, email="test@example.com", provider="test", provider_user_id="uid")
    app.dependency_overrides[get_current_user] = lambda: user
    # Create a spec
    payload = {
        "name": "spec1",
        "spec_json": {"info": {"version": "1.0.0"}, "paths": {}},
    }
    resp = client.post("/specs?version=1.0.0", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    # Update name
    update_payload = {"name": "spec1-renamed", "version": "1.0.0"}
    resp2 = client.put(f"/specs/{data['id']}", json=update_payload)
    assert resp2.status_code == 200
    updated = resp2.json()
    assert updated["name"] == "spec1-renamed"
    # Check Redis
    stored = fake_redis.get(f"spec:1:{data['id']}")
    assert stored is not None
    assert json.loads(stored)["name"] == "spec1-renamed"


@patch("backend.auth.redis_client.get_redis")
def test_user_isolation(mock_get_redis):
    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    mock_get_redis.return_value = fake_redis
    user1 = User(
        id=1, email="user1@example.com", provider="test", provider_user_id="u1"
    )
    user2 = User(
        id=2, email="user2@example.com", provider="test", provider_user_id="u2"
    )
    app.dependency_overrides[get_current_user] = lambda: user1
    # User1 creates a spec
    payload = {"name": "spec-u1", "spec_json": {"info": {"version": "1.0.0"}}}
    resp = client.post("/specs?version=1.0.0", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    # Switch to user2
    app.dependency_overrides[get_current_user] = lambda: user2
    resp2 = client.get(f"/specs/{data['id']}")
    assert resp2.status_code == 404
    # User2 cannot see user1's specs
    resp3 = client.get("/specs")
    assert resp3.status_code == 200
    assert resp3.json() == []
