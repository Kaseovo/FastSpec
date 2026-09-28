"""AWS Lambda entry point for the merged FastSpec + MCP ASGI application.

Cold-start behaviour (only when running inside Lambda):
  - Loads secrets into os.environ, so the rest of the application reads them
    as normal env vars; only their *names/ARNs* appear in the Lambda console
    and CloudFormation:
      * SSM SecureString parameters named by SSM_JWT_SECRET_KEY,
        SSM_OIDC_CLIENT_ID and SSM_OIDC_CLIENT_SECRET;
      * the database passwords DataStack generates into Secrets Manager,
        named by DB_SECRET_ARN (master, migrations only) and
        APP_DB_SECRET_ARN (least-privilege `fastspec_app`, the running app).
    Secrets that can't be loaded are logged by name (never by value); the
    handler still starts, and the app fails with a clear configuration error
    if something it needs is missing.

Invocation modes:
  - {"migrate": true}  → runs database creation + Alembic upgrade head,
                         returns {"statusCode": 200} on success, raises on failure.
  - anything else      → dispatches to the merged FastAPI + MCP ASGI app via
                         Mangum, first telling the WakeStack RDS idle timer the
                         app is in use (database_wake.note_activity).

Handler export: ``lambda_handler.handler``
"""

import json
import os
import sys
from collections.abc import MutableMapping

# SSM SecureString parameters: env var to set → env var holding the name.
SSM_SECRETS = {
    "JWT_SECRET_KEY": "SSM_JWT_SECRET_KEY",
    "OIDC_CLIENT_ID": "SSM_OIDC_CLIENT_ID",
    "OIDC_CLIENT_SECRET": "SSM_OIDC_CLIENT_SECRET",
}
# Secrets Manager secrets: env var to set → env var holding the ARN.
SECRETS_MANAGER_SECRETS = {
    "DB_PASSWORD": "DB_SECRET_ARN",
    "FASTSPEC_APP_DB_PASSWORD": "APP_DB_SECRET_ARN",
}


def secret_password(secret_string: str) -> str:
    """RDS-generated credentials are JSON with a "password" key; a plain
    generated secret is the password itself."""
    try:
        data = json.loads(secret_string)
    except ValueError:
        return secret_string
    if isinstance(data, dict) and "password" in data:
        return str(data["password"])
    return secret_string


def load_secrets(environ: MutableMapping[str, str], ssm, secretsmanager) -> list[str]:
    """Copy secret values into `environ`; return the env vars that couldn't be set."""
    missing: list[str] = []

    wanted = {env: environ[src] for env, src in SSM_SECRETS.items() if environ.get(src)}
    if wanted:
        try:
            response = ssm.get_parameters(Names=list(wanted.values()), WithDecryption=True)
            found = {p["Name"]: p["Value"] for p in response["Parameters"]}
        except Exception:
            found = {}
        for env, name in wanted.items():
            if name in found:
                environ[env] = found[name]
            else:
                missing.append(env)

    for env, src in SECRETS_MANAGER_SECRETS.items():
        arn = environ.get(src)
        if not arn:
            continue
        try:
            value = secretsmanager.get_secret_value(SecretId=arn)["SecretString"]
            environ[env] = secret_password(value)
        except Exception:
            missing.append(env)

    return missing


def _cold_start() -> None:
    try:
        import boto3

        missing = load_secrets(os.environ, boto3.client("ssm"), boto3.client("secretsmanager"))
        if missing:
            print(f"WARNING: could not load secrets: {', '.join(missing)}", file=sys.stderr)
    except Exception as exc:
        print(f"WARNING: loading secrets failed: {exc}", file=sys.stderr)


if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    _cold_start()

from mangum import Mangum  # noqa: E402 — must come after env injection

import database_wake  # noqa: E402
from app import application  # noqa: E402

# ── Mangum ASGI adapter (used for normal HTTP invocations) ────────────────────
_mangum_handler = Mangum(application)


def handler(event, context):
    """Lambda entry-point.

    Routes ``{"migrate": true}`` events to Alembic migrations; all other events
    are dispatched to the merged ASGI application via Mangum.
    """
    if event.get("migrate") is True:
        _run_migrations()
        return {"statusCode": 200}
    database_wake.note_activity()
    return _mangum_handler(event, context)


def _run_migrations():
    """Create the application database (if missing) and run ``alembic upgrade head``.

    Raises RuntimeError if the Alembic command exits with a non-zero code.
    Does *not* call sys.exit() — callers must handle failures via exceptions.
    """
    import subprocess

    import sqlalchemy

    from migrate import build_admin_url

    # Step 1 — ensure the 'fastspec' database exists on the RDS instance
    admin_url = build_admin_url()
    engine = sqlalchemy.create_engine(
        admin_url,
        isolation_level="AUTOCOMMIT",
        connect_args={"sslmode": "require"},
    )
    with engine.connect() as conn:
        result = conn.execute(
            sqlalchemy.text("SELECT 1 FROM pg_database WHERE datname = 'fastspec'")
        )
        if result.fetchone() is None:
            conn.execute(sqlalchemy.text("CREATE DATABASE fastspec"))
    engine.dispose()

    # Step 2 — run Alembic migrations as the admin role, connected to
    # 'fastspec'. Migrations (including the one that creates the
    # least-privilege fastspec_app role — see
    # alembic/versions/b6f1d8c4a9e2_add_fastspec_app_role.py) need DDL
    # privileges the app's own runtime role does not have.
    migration_env = os.environ.copy()
    migration_env["DATABASE_URL"] = build_admin_url(dbname="fastspec")
    proc = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        env=migration_env,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"alembic upgrade head failed with exit code {proc.returncode}"
        )
