"""
MCP write/version/lint tools (fastmcp_server/server.py), called directly with
a test database, plus an HTTP check that API-key actions gate them.
"""

import pytest
from fastapi.testclient import TestClient
from fastmcp.exceptions import ToolError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import database
import fastmcp_server.server as tools
from auth.jwt import create_api_key
from base import Base
from fastmcp_server.authentication import TokenPayload
from models import User
from tests.fakes import FakeSpectralClient

engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

PETS = """
openapi: 3.0.3
info:
  title: Pets
  version: 1.0.0
paths:
  /pets:
    get:
      responses:
        '200':
          description: ok
"""


def _doc(**extra_paths):
    paths = {"/pets": {"get": {"responses": {"200": {"description": "ok"}}}}}
    paths.update(extra_paths)
    return {"openapi": "3.0.3", "info": {"title": "Pets", "version": "1.0.0"}, "paths": paths}


@pytest.fixture(autouse=True)
def db(monkeypatch):
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(tools, "SessionLocal", TestSessionLocal)
    monkeypatch.setattr(tools, "get_spectral_client", lambda: FakeSpectralClient(score=90))
    session = TestSessionLocal()
    for uid in (1, 2):
        session.add(User(id=uid, email=f"u{uid}@example.com", provider="local", provider_user_id=f"u{uid}"))
    session.commit()
    session.close()
    yield
    Base.metadata.drop_all(bind=engine)


def _user(uid=1):
    return TokenPayload(sub=str(uid), actions=["All"], token_type="short", exp=0, iat=0)


def _create(name="pets", content=PETS, version="1.0.0", uid=1):
    return tools.create_spec(name=name, content=content, version=version, user=_user(uid))


# ── validate / create / delete ────────────────────────────────────────────────


def test_validate_spec_accepts_yaml_text():
    assert tools.validate_spec(content=PETS, user=_user())["valid"] is True


def test_validate_spec_reports_errors():
    result = tools.validate_spec(content={"info": {"title": "x"}}, user=_user())
    assert result["valid"] is False
    assert any(e["field"] == "openapi" for e in result["errors"])


def test_create_spec_from_yaml():
    created = _create()
    details = tools.get_spec_details(spec_id=created["id"], user=_user())
    assert details["name"] == "pets"
    assert details["content"]["paths"]["/pets"]


def test_create_spec_rejects_invalid_documents_with_reasons():
    with pytest.raises(ToolError, match="Invalid OpenAPI document") as exc:
        _create(content={"info": {"title": "x"}})
    assert "openapi" in str(exc.value)


def test_create_spec_rejects_unparsable_text():
    with pytest.raises(ToolError, match="isn't valid YAML or JSON"):
        _create(content="openapi: [")


def test_create_spec_name_conflict():
    _create()
    with pytest.raises(ToolError, match="already exists"):
        _create()


def test_delete_spec():
    created = _create()
    tools.delete_spec(spec_id=created["id"], user=_user())
    assert tools.get_saved_specs_for_user(user=_user()) == []


def test_specs_are_private_to_their_owner():
    created = _create()
    with pytest.raises(ToolError, match="not found"):
        tools.get_spec_details(spec_id=created["id"], user=_user(2))
    with pytest.raises(ToolError, match="not found"):
        tools.save_spec_version(spec_id=created["id"], version="2.0.0", content=PETS, user=_user(2))
    with pytest.raises(ToolError, match="not found"):
        tools.delete_spec(spec_id=created["id"], user=_user(2))


# ── versions ─────────────────────────────────────────────────────────────────


def test_save_new_version_becomes_current():
    created = _create()
    saved = tools.save_spec_version(
        spec_id=created["id"], version="1.1.0", content=_doc(**{"/owners": {}}), user=_user()
    )
    assert saved["version"] == "1.1.0" and saved["replaced"] is False

    listing = tools.list_spec_versions(spec_id=created["id"], user=_user())
    assert listing["current"] == "1.1.0"
    assert {v["version"] for v in listing["versions"]} == {"1.0.0", "1.1.0"}
    assert "/owners" in tools.get_spec_details(spec_id=created["id"], user=_user())["content"]["paths"]


def test_existing_version_needs_explicit_overwrite():
    created = _create()
    with pytest.raises(ToolError, match="overwrite=true"):
        tools.save_spec_version(spec_id=created["id"], version="1.0.0", content=_doc(), user=_user())

    saved = tools.save_spec_version(
        spec_id=created["id"], version="1.0.0", content=_doc(**{"/owners": {}}), overwrite=True, user=_user()
    )

    assert saved["replaced"] is True
    stored = tools.get_spec_version(spec_id=created["id"], version="1.0.0", user=_user())
    assert "/owners" in stored["content"]["paths"]


def test_save_version_rejects_invalid_documents():
    created = _create()
    with pytest.raises(ToolError, match="Invalid OpenAPI document"):
        tools.save_spec_version(spec_id=created["id"], version="2.0.0", content={"paths": {}}, user=_user())


def test_compare_versions_and_unsaved_content():
    created = _create()
    tools.save_spec_version(spec_id=created["id"], version="1.1.0", content=_doc(**{"/owners": {"get": {"responses": {"200": {"description": "ok"}}}}}), user=_user())

    stored = tools.compare_spec_versions(
        spec_id=created["id"], base_version="1.0.0", compare_version="1.1.0", user=_user()
    )
    draft = tools.compare_spec_versions(
        spec_id=created["id"], base_version="1.0.0", compare_content=_doc(**{"/stores": {"get": {"responses": {"200": {"description": "ok"}}}}}), user=_user()
    )

    # Changes read from base to compare: these endpoints were added.
    assert "Added Endpoints" in stored["markdown"] and "/owners" in stored["markdown"]
    assert "Removed Endpoints" not in stored["markdown"]
    assert "Added Endpoints" in draft["markdown"] and "/stores" in draft["markdown"]
    assert draft["compare"] == "unsaved document"


def test_compare_needs_exactly_one_target():
    created = _create()
    with pytest.raises(ToolError, match="exactly one"):
        tools.compare_spec_versions(spec_id=created["id"], base_version="1.0.0", user=_user())


# ── lint ─────────────────────────────────────────────────────────────────────


def test_lint_stored_spec_and_unsaved_content():
    created = _create()
    stored = tools.lint_spec(spec_id=created["id"], user=_user())
    draft = tools.lint_spec(content=PETS, user=_user())
    assert stored["score"] == draft["score"] == 90
    assert stored["findings"] == []


def test_lint_needs_something_to_lint():
    with pytest.raises(ToolError, match="Pass spec_id, content, or both"):
        tools.lint_spec(user=_user())


def test_lint_refuses_other_users_specs():
    created = _create()
    with pytest.raises(ToolError, match="not found"):
        tools.lint_spec(spec_id=created["id"], user=_user(2))


# ── permissions over HTTP ────────────────────────────────────────────────────


def _rpc(client, key, method, params=None):
    resp = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
        headers={"Accept": "application/json, text/event-stream", "Authorization": f"Bearer {key}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_api_key_actions_gate_the_tools():
    from app import application

    db = database.SessionLocal()
    user = User(email="reader@example.com", provider="local", provider_user_id="reader")
    db.add(user)
    db.commit()
    read_only, _, _ = create_api_key(db, user, ["read:specs"])
    everything, _, _ = create_api_key(db, user, ["All"])

    try:
        with TestClient(application) as client:
            visible = {t["name"] for t in _rpc(client, read_only, "tools/list")["result"]["tools"]}
            assert "get_saved_specs_for_user" in visible
            assert not visible & {"create_spec", "save_spec_version", "delete_spec", "lint_spec"}

            denied = _rpc(client, read_only, "tools/call", {"name": "create_spec", "arguments": {"name": "x", "content": PETS}})
            assert "error" in denied or denied["result"]["isError"]

            all_tools = {t["name"] for t in _rpc(client, everything, "tools/list")["result"]["tools"]}
            assert {"create_spec", "save_spec_version", "lint_spec", "compare_spec_versions"} <= all_tools
    finally:
        db.delete(user)
        db.commit()
        db.close()
