"""The AWS Lambda entry point (lambda_handler.py): cold-start secret loading
and invocation dispatch."""

import lambda_handler
from lambda_handler import load_secrets


class FakeSSM:
    def __init__(self, values):
        self.values = values

    def get_parameters(self, Names, WithDecryption):
        assert WithDecryption
        return {"Parameters": [{"Name": n, "Value": self.values[n]} for n in Names if n in self.values]}


def test_loads_ssm_parameters():
    environ = {
        "SSM_DATABASE_URL": "/prod/fastspec/database-url",
        "SSM_JWT_SECRET_KEY": "/prod/fastspec/secret-key",
        "SSM_OIDC_CLIENT_ID": "/prod/fastspec/google-client-id",
    }
    ssm = FakeSSM(
        {
            "/prod/fastspec/database-url": "postgresql://u:p@db.example.com/fastspec",
            "/prod/fastspec/secret-key": "jwt",
            "/prod/fastspec/google-client-id": "cid",
        }
    )

    missing = load_secrets(environ, ssm)

    assert missing == []
    assert environ["DATABASE_URL"] == "postgresql://u:p@db.example.com/fastspec"
    assert environ["JWT_SECRET_KEY"] == "jwt"
    assert environ["OIDC_CLIENT_ID"] == "cid"


def test_reports_what_could_not_be_loaded():
    environ = {"SSM_JWT_SECRET_KEY": "/missing", "SSM_DATABASE_URL": "/also-missing"}

    missing = load_secrets(environ, FakeSSM({}))

    assert sorted(missing) == ["DATABASE_URL", "JWT_SECRET_KEY"]
    assert "JWT_SECRET_KEY" not in environ


def test_ssm_failure_reports_everything_missing():
    class BrokenSSM:
        def get_parameters(self, **kwargs):
            raise RuntimeError("AccessDenied")

    missing = load_secrets({"SSM_JWT_SECRET_KEY": "/prod/fastspec/secret-key"}, BrokenSSM())

    assert missing == ["JWT_SECRET_KEY"]


def test_nothing_configured_means_nothing_to_load():
    environ: dict[str, str] = {}
    assert load_secrets(environ, FakeSSM({})) == []
    assert environ == {}


def test_dispatches_migrations_and_http_requests(monkeypatch):
    calls = []
    monkeypatch.setattr(lambda_handler, "_run_migrations", lambda: calls.append("migrate"))
    monkeypatch.setattr(
        lambda_handler, "_mangum_handler", lambda event, context: calls.append("http") or {"statusCode": 200}
    )

    assert lambda_handler.handler({"migrate": True}, None) == {"statusCode": 200}
    assert lambda_handler.handler({"rawPath": "/health"}, None) == {"statusCode": 200}
    assert calls == ["migrate", "http"]
