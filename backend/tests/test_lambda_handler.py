"""Cold-start secret loading for the AWS Lambda (lambda_handler.py)."""

import json

import pytest

from lambda_handler import load_secrets, secret_password


class FakeSSM:
    def __init__(self, values):
        self.values = values

    def get_parameters(self, Names, WithDecryption):
        assert WithDecryption
        return {"Parameters": [{"Name": n, "Value": self.values[n]} for n in Names if n in self.values]}


class FakeSecretsManager:
    def __init__(self, values):
        self.values = values

    def get_secret_value(self, SecretId):
        if SecretId not in self.values:
            raise RuntimeError("AccessDenied")
        return {"SecretString": self.values[SecretId]}


def test_loads_ssm_parameters_and_database_secrets():
    environ = {
        "SSM_JWT_SECRET_KEY": "/prod/fastspec/secret-key",
        "SSM_OIDC_CLIENT_ID": "/prod/fastspec/google-client-id",
        "DB_SECRET_ARN": "arn:master",
        "APP_DB_SECRET_ARN": "arn:app",
    }
    ssm = FakeSSM({"/prod/fastspec/secret-key": "jwt", "/prod/fastspec/google-client-id": "cid"})
    sm = FakeSecretsManager(
        {
            # RDS-generated master credentials are JSON…
            "arn:master": json.dumps({"username": "postgres", "password": "master-pw"}),
            # …a plain generated secret is the password itself.
            "arn:app": "app-pw",
        }
    )

    missing = load_secrets(environ, ssm, sm)

    assert missing == []
    assert environ["JWT_SECRET_KEY"] == "jwt"
    assert environ["OIDC_CLIENT_ID"] == "cid"
    assert environ["DB_PASSWORD"] == "master-pw"
    assert environ["FASTSPEC_APP_DB_PASSWORD"] == "app-pw"


def test_reports_what_could_not_be_loaded():
    environ = {"SSM_JWT_SECRET_KEY": "/missing", "APP_DB_SECRET_ARN": "arn:denied"}

    missing = load_secrets(environ, FakeSSM({}), FakeSecretsManager({}))

    assert sorted(missing) == ["FASTSPEC_APP_DB_PASSWORD", "JWT_SECRET_KEY"]
    assert "JWT_SECRET_KEY" not in environ


def test_nothing_configured_means_nothing_to_load():
    environ: dict[str, str] = {}
    assert load_secrets(environ, FakeSSM({}), FakeSecretsManager({})) == []
    assert environ == {}


@pytest.mark.parametrize(
    "secret, password",
    [
        ('{"username": "postgres", "password": "p@ss"}', "p@ss"),
        ("plain-generated-value", "plain-generated-value"),
        ('"a json string"', '"a json string"'),
    ],
)
def test_secret_password(secret, password):
    assert secret_password(secret) == password
