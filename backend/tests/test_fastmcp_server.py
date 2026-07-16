import pytest
from fastmcp.exceptions import ToolError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import fastmcp_server.server as mcp_server
from fastmcp_server.authentication import TokenPayload
from base import Base
from models import OpenAPISpec, SpecVersion

# In-memory SQLite dedicated to this test module.
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def db_session(monkeypatch):
    Base.metadata.create_all(bind=engine)
    # The MCP tool functions call SessionLocal() themselves (they don't take a
    # session as a dependency), so point the module's SessionLocal at our
    # test engine for the duration of each test.
    monkeypatch.setattr(mcp_server, "SessionLocal", TestSessionLocal)
    yield
    Base.metadata.drop_all(bind=engine)


def _token(user_id: int) -> TokenPayload:
    return TokenPayload(
        sub=str(user_id), actions=[], token_type="access", exp=0, iat=0
    )


def _make_spec(session, *, spec_id, user_id, name, title, version="1.0.0"):
    spec = OpenAPISpec(id=spec_id, name=name, version=version, user_id=user_id)
    session.add(spec)
    session.flush()
    session.add(
        SpecVersion(
            spec_id=spec_id,
            version=version,
            content={"info": {"title": title}, "openapi": "3.0.0", "paths": {}},
            created_by=user_id,
        )
    )
    session.commit()


def test_get_saved_specs_for_user_returns_specs_with_derived_title():
    session = TestSessionLocal()
    _make_spec(session, spec_id="spec-1", user_id=1, name="spec-1", title="My API")
    session.close()

    result = mcp_server.get_saved_specs_for_user(user=_token(1))

    assert len(result) == 1
    assert result[0]["id"] == "spec-1"
    assert result[0]["name"] == "spec-1"
    assert result[0]["title"] == "My API"
    assert result[0]["version"] == "1.0.0"


def test_get_saved_specs_for_user_only_returns_own_specs():
    session = TestSessionLocal()
    _make_spec(session, spec_id="spec-1", user_id=1, name="mine", title="Mine")
    _make_spec(session, spec_id="spec-2", user_id=2, name="theirs", title="Theirs")
    session.close()

    result = mcp_server.get_saved_specs_for_user(user=_token(1))

    assert [s["id"] for s in result] == ["spec-1"]


def test_get_spec_details_returns_content():
    session = TestSessionLocal()
    _make_spec(session, spec_id="spec-1", user_id=1, name="spec-1", title="My API")
    session.close()

    result = mcp_server.get_spec_details(spec_id="spec-1", user=_token(1))

    assert result["id"] == "spec-1"
    assert result["title"] == "My API"
    assert result["content"]["info"]["title"] == "My API"


def test_get_spec_details_raises_tool_error_when_not_found_or_not_owned():
    session = TestSessionLocal()
    _make_spec(session, spec_id="spec-1", user_id=2, name="theirs", title="Theirs")
    session.close()

    with pytest.raises(ToolError):
        mcp_server.get_spec_details(spec_id="spec-1", user=_token(1))

    with pytest.raises(ToolError):
        mcp_server.get_spec_details(spec_id="does-not-exist", user=_token(1))
