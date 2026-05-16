import json
from unittest.mock import MagicMock, patch
import pytest

from services.spec_service import SpecService
from backend.auth.redis_client import get_redis
from schemas import OpenAPISpecCreate, OpenAPISpecUpdate

import uuid
import fakeredis


class DummyUser:
    def __init__(self, id):
        self.id = id


def make_spec_model(id, name, title, version, spec_json, user_id):
    m = MagicMock()
    m.id = id
    m.name = name
    m.title = title
    m.version = version
    m.spec_json = spec_json
    m.user_id = user_id
    m.created_at = "created"
    m.updated_at = "updated"
    return m


@patch("backend.auth.redis_client.get_redis")
def test_list_specs_returns_serialized_list(mock_get_redis):
    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    mock_get_redis.return_value = fake_redis
    user = DummyUser(1)
    spec_id = str(uuid.uuid4())
    spec_obj = {
        "id": spec_id,
        "name": "s1",
        "title": "Title",
        "version": "1.0",
        "spec_json": {"info": {}},
        "user_id": 1,
        "created_at": "2023-01-01T00:00:00",
        "updated_at": "2023-01-01T00:00:00",
    }
    fake_redis.set(f"spec:1:{spec_id}", json.dumps(spec_obj))
    fake_redis.sadd("specs:1", spec_id)
    svc = SpecService()
    res = svc.list_specs(user)
    assert isinstance(res, list)
    assert res[0].id == spec_id


@patch("backend.auth.redis_client.get_redis")
def test_get_spec_not_found_raises(mock_get_redis):
    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    mock_get_redis.return_value = fake_redis
    user = DummyUser(1)
    svc = SpecService()
    with pytest.raises(Exception):
        svc.get_spec(user, "nope")


@patch("backend.auth.redis_client.get_redis")
def test_create_spec_validates_and_creates(mock_get_redis):
    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    mock_get_redis.return_value = fake_redis
    user = DummyUser(2)
    payload = OpenAPISpecCreate(name="new", spec_json={"info": {}})
    svc = SpecService()
    res = svc.create_spec(user, payload, "1.2.3")
    assert res.name == "new"
    assert res.version == "1.2.3"
    # Check persistence
    keys = fake_redis.smembers("specs:2")
    assert len(keys) == 1
    stored = fake_redis.get(f"spec:2:{res.id}")
    assert stored is not None


@patch("backend.auth.redis_client.get_redis")
def test_update_spec_name_conflict(mock_get_redis):
    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    mock_get_redis.return_value = fake_redis
    user = DummyUser(1)
    # Create two specs for user 1
    spec_id = str(uuid.uuid4())
    other_id = str(uuid.uuid4())
    spec_obj = {
        "id": spec_id,
        "name": "s1",
        "title": "T",
        "version": "1.0",
        "spec_json": {"info": {}},
        "user_id": 1,
        "created_at": "2023-01-01T00:00:00",
        "updated_at": "2023-01-01T00:00:00",
    }
    other_obj = dict(spec_obj)
    other_obj["id"] = other_id
    other_obj["name"] = "other"
    fake_redis.set(f"spec:1:{spec_id}", json.dumps(spec_obj))
    fake_redis.set(f"spec:1:{other_id}", json.dumps(other_obj))
    fake_redis.sadd("specs:1", spec_id, other_id)
    svc = SpecService()
    with pytest.raises(Exception):
        svc.update_spec(user, spec_id, OpenAPISpecUpdate(version="1.0", name="other"))


@patch("backend.auth.redis_client.get_redis")
def test_delete_spec_not_found(mock_get_redis):
    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    mock_get_redis.return_value = fake_redis
    user = DummyUser(1)
    svc = SpecService()
    with pytest.raises(Exception):
        svc.delete_spec(user, "nope")


@patch("backend.auth.redis_client.get_redis")
def test_delete_spec_success(mock_get_redis):
    fake_redis = fakeredis.FakeStrictRedis(decode_responses=True)
    mock_get_redis.return_value = fake_redis
    user = DummyUser(1)
    spec_id = str(uuid.uuid4())
    spec_obj = {
        "id": spec_id,
        "name": "s1",
        "title": "T",
        "version": "1.0",
        "spec_json": {"info": {}},
        "user_id": 1,
        "created_at": "2023-01-01T00:00:00",
        "updated_at": "2023-01-01T00:00:00",
    }
    fake_redis.set(f"spec:1:{spec_id}", json.dumps(spec_obj))
    fake_redis.sadd("specs:1", spec_id)
    svc = SpecService()
    svc.delete_spec(user, spec_id)
    assert fake_redis.get(f"spec:1:{spec_id}") is None
    assert spec_id not in fake_redis.smembers("specs:1")
