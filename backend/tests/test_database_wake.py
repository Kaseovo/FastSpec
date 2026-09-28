"""A database that sleeps when idle (database_wake.py), and what the API
answers while it can't reach the database."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

import database_wake
import main
import routers.auth as auth_router
from main import app

client = TestClient(app)


class FakeRDS:
    def __init__(self, status: str):
        self.status = status
        self.started: list[str] = []

    def describe_db_instances(self, DBInstanceIdentifier):
        return {"DBInstances": [{"DBInstanceStatus": self.status}]}

    def start_db_instance(self, DBInstanceIdentifier):
        self.started.append(DBInstanceIdentifier)


class FakeSSM:
    def __init__(self):
        self.puts: list[dict] = []

    def put_parameter(self, **kwargs):
        self.puts.append(kwargs)


def _unreachable(*args, **kwargs):
    raise OperationalError("SELECT 1", {}, Exception("connection refused"))


@pytest.fixture
def aws(monkeypatch):
    """Fake AWS clients, and fresh throttles for each test."""
    clients = {"rds": FakeRDS("stopped"), "ssm": FakeSSM()}
    monkeypatch.setattr(database_wake, "_client", lambda service: clients[service])
    monkeypatch.setattr(database_wake, "_last_activity", None)
    monkeypatch.setattr(database_wake, "_last_start_check", None)
    return clients


@pytest.fixture
def sleeping_database(monkeypatch):
    """Configured like the AWS deployment."""
    monkeypatch.setenv("RDS_INSTANCE_ID", "fastspec-db")
    monkeypatch.setenv("SSM_WAKE_PARAM", "/prod/fastspec/wake-last-triggered")


@pytest.fixture
def database_down(monkeypatch):
    class DownSession:
        execute = staticmethod(_unreachable)

        def close(self):
            pass

    monkeypatch.setattr(main, "SessionLocal", DownSession)


# ── database_wake ─────────────────────────────────────────────────────────────


def test_starts_a_stopped_database(aws, sleeping_database):
    database_wake.request_start()
    assert aws["rds"].started == ["fastspec-db"]


@pytest.mark.parametrize("status", ["available", "starting", "stopping"])
def test_leaves_a_database_that_is_not_stopped_alone(aws, sleeping_database, status):
    aws["rds"].status = status
    database_wake.request_start()
    assert aws["rds"].started == []


def test_start_checks_are_throttled(aws, sleeping_database):
    aws["rds"].status = "stopping"
    database_wake.request_start()
    aws["rds"].status = "stopped"
    database_wake.request_start()
    assert aws["rds"].started == []


def test_activity_is_noted_at_most_every_few_minutes(aws, sleeping_database):
    database_wake.note_activity()
    database_wake.note_activity()

    assert len(aws["ssm"].puts) == 1
    put = aws["ssm"].puts[0]
    assert put["Name"] == "/prod/fastspec/wake-last-triggered"
    float(put["Value"])  # a Unix timestamp, as the auto-stop Lambda expects


def test_does_nothing_where_the_database_does_not_sleep(aws, monkeypatch):
    monkeypatch.delenv("RDS_INSTANCE_ID", raising=False)
    monkeypatch.delenv("SSM_WAKE_PARAM", raising=False)

    database_wake.note_activity()
    database_wake.request_start()

    assert aws["rds"].started == [] and aws["ssm"].puts == []
    assert not database_wake.can_start()


def test_aws_errors_never_fail_the_request(sleeping_database, monkeypatch):
    def denied(service):
        raise RuntimeError("AccessDenied")

    monkeypatch.setattr(database_wake, "_client", denied)
    monkeypatch.setattr(database_wake, "_last_activity", None)
    monkeypatch.setattr(database_wake, "_last_start_check", None)

    database_wake.note_activity()
    database_wake.request_start()


# ── The API while the database is unreachable ─────────────────────────────────


def test_readiness_when_the_database_is_up():
    resp = client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}


def test_readiness_wakes_a_sleeping_database(aws, sleeping_database, database_down):
    resp = client.get("/health/ready")

    assert resp.status_code == 503
    assert resp.json()["code"] == "database_starting"
    assert aws["rds"].started == ["fastspec-db"]


def test_readiness_where_the_database_does_not_sleep(aws, database_down, monkeypatch):
    monkeypatch.delenv("RDS_INSTANCE_ID", raising=False)

    resp = client.get("/health/ready")

    assert resp.status_code == 503
    assert resp.json()["code"] == "database_unavailable"


def test_database_errors_in_any_endpoint_become_a_503(aws, sleeping_database, monkeypatch):
    monkeypatch.setattr(auth_router, "get_or_create_local_user", _unreachable)

    resp = client.post("/auth/local/session")

    assert resp.status_code == 503
    assert resp.json()["code"] == "database_starting"
    assert aws["rds"].started == ["fastspec-db"]
