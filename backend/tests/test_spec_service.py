import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from services.spec_service import SpecService
from schemas import OpenAPISpecCreate, OpenAPISpecUpdate
from models import User, OpenAPISpec, SpecVersion

# In-memory SQLite for tests
engine = create_engine("sqlite:///:memory:")
TestSessionLocal = sessionmaker(bind=engine)


@pytest.fixture(autouse=True)
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


class DummyUser:
    def __init__(self, id):
        self.id = id


def test_list_specs_empty(db_session):
    user = DummyUser(1)
    svc = SpecService(db_session)
    res = svc.list_specs(user)
    assert res == []


def test_create_spec_validates_and_creates(db_session):
    user = DummyUser(2)
    payload = OpenAPISpecCreate(
        name="new",
        spec_json={"info": {"title": "Test"}, "openapi": "3.0.0", "paths": {}},
    )
    svc = SpecService(db_session)
    res = svc.create_spec(user, payload, "1.2.3")
    assert res.name == "new"
    assert res.version == "1.2.3"
    assert res.title == "Test"
    # Verify in DB
    spec = db_session.query(OpenAPISpec).filter(OpenAPISpec.id == res.id).first()
    assert spec is not None
    assert spec.name == "new"
    ver = db_session.query(SpecVersion).filter(SpecVersion.spec_id == res.id).first()
    assert ver is not None
    assert ver.version == "1.2.3"


def test_list_specs_returns_created(db_session):
    user = DummyUser(1)
    svc = SpecService(db_session)
    payload = OpenAPISpecCreate(
        name="s1", spec_json={"info": {"title": "T"}, "openapi": "3.0.0", "paths": {}}
    )
    svc.create_spec(user, payload, "1.0.0")
    res = svc.list_specs(user)
    assert len(res) == 1
    assert res[0].name == "s1"


def test_get_spec_not_found_raises(db_session):
    user = DummyUser(1)
    svc = SpecService(db_session)
    with pytest.raises(Exception):
        svc.get_spec(user, "nope")


def test_update_spec_name(db_session):
    user = DummyUser(1)
    svc = SpecService(db_session)
    payload = OpenAPISpecCreate(
        name="orig", spec_json={"info": {"title": "T"}, "openapi": "3.0.0", "paths": {}}
    )
    created = svc.create_spec(user, payload, "1.0.0")
    updated = svc.update_spec(
        user, created.id, OpenAPISpecUpdate(version="1.0.0", name="renamed")
    )
    assert updated.name == "renamed"


def test_update_spec_name_conflict(db_session):
    user = DummyUser(1)
    svc = SpecService(db_session)
    spec_json = {"info": {"title": "T"}, "openapi": "3.0.0", "paths": {}}
    svc.create_spec(user, OpenAPISpecCreate(name="s1", spec_json=spec_json), "1.0.0")
    created2 = svc.create_spec(
        user, OpenAPISpecCreate(name="s2", spec_json=spec_json), "1.0.0"
    )
    with pytest.raises(Exception):
        svc.update_spec(
            user, created2.id, OpenAPISpecUpdate(version="1.0.0", name="s1")
        )


def test_delete_spec_success(db_session):
    user = DummyUser(1)
    svc = SpecService(db_session)
    payload = OpenAPISpecCreate(
        name="to-delete",
        spec_json={"info": {"title": "T"}, "openapi": "3.0.0", "paths": {}},
    )
    created = svc.create_spec(user, payload, "1.0.0")
    svc.delete_spec(user, created.id)
    assert (
        db_session.query(OpenAPISpec).filter(OpenAPISpec.id == created.id).first()
        is None
    )


def test_delete_spec_not_found(db_session):
    user = DummyUser(1)
    svc = SpecService(db_session)
    with pytest.raises(Exception):
        svc.delete_spec(user, "nope")


def test_user_isolation(db_session):
    user1 = DummyUser(1)
    user2 = DummyUser(2)
    svc = SpecService(db_session)
    spec_json = {"info": {"title": "T"}, "openapi": "3.0.0", "paths": {}}
    svc.create_spec(
        user1, OpenAPISpecCreate(name="u1-spec", spec_json=spec_json), "1.0.0"
    )
    # user2 should not see user1's spec
    assert svc.list_specs(user2) == []
    with pytest.raises(Exception):
        svc.get_spec(user2, "some-id")
