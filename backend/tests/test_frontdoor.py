"""
Single-origin routing (frontdoor.py): API under /api, MCP at /mcp, the built
SPA under /specs when self-hosted — and an end-to-end MCP call through it.
"""

import pytest
from fastapi.testclient import TestClient

import database
from app import mcp_asgi_app
from auth.jwt import create_api_key
from frontdoor import FrontDoor
from main import app
from models import User

MCP_HEADERS = {"Accept": "application/json, text/event-stream"}


@pytest.fixture
def static_dir(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>spa</html>")
    (tmp_path / "assets" / "app.js").write_text("console.log('x');" * 200)
    (tmp_path / "icon.svg").write_text("<svg/>")
    (tmp_path.parent / "secret.txt").write_text("nope")
    return tmp_path


@pytest.fixture
def self_hosted(static_dir):
    with TestClient(FrontDoor(app, mcp_asgi_app, static_dir=str(static_dir))) as client:
        yield client


@pytest.fixture
def lambda_style():
    with TestClient(FrontDoor(app, mcp_asgi_app)) as client:
        yield client


# ── SPA serving ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize("path", ["/", "/specs"])
def test_root_redirects_to_spa(self_hosted, path):
    resp = self_hosted.get(path, follow_redirects=False)
    assert resp.status_code == 307
    assert resp.headers["location"] == "/specs/"


@pytest.mark.parametrize("path", ["/specs/", "/specs/some-id", "/specs/some-id/preview", "/specs/auth/callback"])
def test_client_side_routes_serve_index(self_hosted, path):
    resp = self_hosted.get(path)
    assert resp.status_code == 200
    assert resp.text == "<html>spa</html>"
    assert resp.headers["cache-control"] == "no-cache"


def test_hashed_assets_are_cached_forever_and_gzipped(self_hosted):
    resp = self_hosted.get("/specs/assets/app.js", headers={"Accept-Encoding": "gzip"})
    assert resp.status_code == 200
    assert "immutable" in resp.headers["cache-control"]
    assert resp.headers["content-encoding"] == "gzip"


def test_public_files_are_served(self_hosted):
    assert self_hosted.get("/specs/icon.svg").text == "<svg/>"


def test_missing_asset_is_404_not_html(self_hosted):
    assert self_hosted.get("/specs/assets/missing.js").status_code == 404


def test_path_traversal_is_not_served(self_hosted):
    resp = self_hosted.get("/specs/..%2Fsecret.txt")
    assert "nope" not in resp.text


def test_api_is_under_api_prefix(self_hosted):
    assert self_hosted.get("/api/health").json() == {"status": "healthy"}
    # Unauthenticated, but routed to the API (not the SPA).
    assert self_hosted.get("/api/specs/").status_code == 403


@pytest.mark.parametrize("path", ["/auth/config", "/health", "/version", "/openapi.json"])
def test_other_backend_routes_stay_at_root(self_hosted, path):
    assert self_hosted.get(path).status_code == 200


def test_without_static_dir_specs_is_the_api(lambda_style):
    """Lambda: CloudFront serves the SPA from S3; /specs stays the API."""
    assert lambda_style.get("/specs/").status_code == 403
    assert lambda_style.get("/api/specs/").status_code == 403


def test_static_dir_without_index_is_rejected(tmp_path):
    with pytest.raises(RuntimeError, match="no index.html"):
        FrontDoor(app, mcp_asgi_app, static_dir=str(tmp_path))


# ── MCP over HTTP ────────────────────────────────────────────────────────────


def _rpc(client, method, params=None, token=None):
    headers = dict(MCP_HEADERS)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}
    resp = client.post("/mcp", json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.fixture
def api_key():
    db = database.SessionLocal()
    user = User(email="mcp@example.com", provider="local", provider_user_id="mcp-test")
    db.add(user)
    db.commit()
    raw, _, _ = create_api_key(db, user, ["All"])
    yield raw
    db.delete(user)
    db.commit()
    db.close()


def test_mcp_initialize(lambda_style):
    result = _rpc(
        lambda_style,
        "initialize",
        {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1"},
        },
    )
    assert "serverInfo" in result["result"]


def test_mcp_requires_an_api_key(lambda_style):
    assert "error" in _rpc(lambda_style, "tools/list")


def test_mcp_tools_work_with_an_api_key(lambda_style, api_key):
    tools = _rpc(lambda_style, "tools/list", token=api_key)["result"]["tools"]
    assert "get_saved_specs_for_user" in {t["name"] for t in tools}

    result = _rpc(
        lambda_style,
        "tools/call",
        {"name": "get_saved_specs_for_user", "arguments": {}},
        token=api_key,
    )["result"]
    assert result["isError"] is False
    assert result["structuredContent"] == {"result": []}


def test_version_links_to_the_source(lambda_style, monkeypatch):
    """AGPL §13: the running instance tells users where its source is."""
    from config import settings

    monkeypatch.setattr(settings, "source_url", "https://git.example.com/fork")
    body = lambda_style.get("/version").json()
    assert body["source_url"] == "https://git.example.com/fork"
    assert body["version"]
