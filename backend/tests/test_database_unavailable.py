"""What the API answers while it can't reach the database: 503, not 500."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

import main
import routers.auth as auth_router
from main import app

client = TestClient(app)


def _unreachable(*args, **kwargs):
    raise OperationalError("SELECT 1", {}, Exception("connection refused"))


@pytest.fixture
def database_down(monkeypatch):
    class DownSession:
        execute = staticmethod(_unreachable)

        def close(self):
            pass

    monkeypatch.setattr(main, "SessionLocal", DownSession)


def test_readiness_when_the_database_is_up():
    resp = client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}


def test_readiness_when_the_database_is_down(database_down):
    resp = client.get("/health/ready")

    assert resp.status_code == 503
    assert resp.json()["code"] == "database_unavailable"


def test_database_errors_in_any_endpoint_become_a_503(monkeypatch):
    monkeypatch.setattr(auth_router, "get_or_create_local_user", _unreachable)

    resp = client.post("/auth/local/session")

    assert resp.status_code == 503
    assert resp.json()["code"] == "database_unavailable"
