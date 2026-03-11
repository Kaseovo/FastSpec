import json
from unittest.mock import MagicMock
import pytest

from services.spec_service import SpecService
from schemas import OpenAPISpecCreate, OpenAPISpecUpdate


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


def test_list_specs_returns_serialized_list():
    db = MagicMock()
    user = DummyUser(1)
    spec = make_spec_model("abc", "s1", "Title", "1.0", {"info": {}}, 1)
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        spec
    ]
    svc = SpecService(db)
    res = svc.list_specs(user)
    assert isinstance(res, list)
    assert res[0]["id"] == "abc"


def test_get_spec_not_found_raises():
    db = MagicMock()
    user = DummyUser(1)
    db.query.return_value.filter.return_value.first.return_value = None
    svc = SpecService(db)
    with pytest.raises(Exception):
        svc.get_spec(user, "nope")


def test_create_spec_validates_and_creates():
    db = MagicMock()
    user = DummyUser(2)
    payload = OpenAPISpecCreate(name="new", spec_json={"info": {}})
    # no existing
    db.query.return_value.filter.return_value.first.return_value = None

    # mock refresh to set id
    def refresh(obj):
        if hasattr(obj, "id"):
            return
        obj.id = "new-id"

    db.refresh.side_effect = refresh
    svc = SpecService(db)
    res = svc.create_spec(user, payload, "1.2.3")
    assert res["name"] == "new"
    assert res["initial_version"]["version"] == "1.2.3"


def test_update_spec_name_conflict():
    db = MagicMock()
    user = DummyUser(1)
    existing = make_spec_model("x", "other", "T", "1.0", {"info": {}}, 1)
    spec = make_spec_model("s", "s1", "T", "1.0", {"info": {}}, 1)
    # first call to find spec returns spec, second call to find existing returns existing
    db.query.return_value.filter.return_value.first.side_effect = [spec, existing]
    svc = SpecService(db)
    with pytest.raises(Exception):
        svc.update_spec(user, "s", OpenAPISpecUpdate(version="1.0", name="other"))


def test_delete_spec_not_found():
    db = MagicMock()
    user = DummyUser(1)
    db.query.return_value.filter.return_value.first.return_value = None
    svc = SpecService(db)
    with pytest.raises(Exception):
        svc.delete_spec(user, "nope")
