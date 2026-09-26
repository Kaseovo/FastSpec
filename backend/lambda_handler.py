"""AWS Lambda entry point for the merged FastSpec + MCP ASGI application.

Cold-start behaviour:
  - Fetches SecureString secrets (JWT_SECRET_KEY, DB_PASSWORD, OIDC client
    ID/secret) from SSM Parameter Store and injects them into os.environ so the
    rest of the application reads them as normal env vars.  Parameter *names*
    are passed in via SSM_JWT_SECRET_KEY, SSM_DB_PASSWORD, SSM_OIDC_CLIENT_ID… env vars —
    no plaintext secrets ever appear in the Lambda console or CloudFormation.
  - Writes the current UTC timestamp to the SSM parameter named by SSM_WAKE_PARAM
    (used by the WakeStack RDS idle timer).
  - Errors from SSM are silently swallowed — a missing env var or IAM permission
    must never crash the handler.

Invocation modes:
  - {"migrate": true}  → runs database creation + Alembic upgrade head,
                         returns {"statusCode": 200} on success, raises on failure.
  - anything else      → dispatches to the merged FastAPI + MCP ASGI app via Mangum.

Handler export: ``lambda_handler.handler``
"""

import os
from datetime import UTC, datetime

# ── Cold-start: fetch secrets from SSM and inject into environment ────────────
try:
    import boto3

    _ssm = boto3.client("ssm")

    _secret_params = {
        "JWT_SECRET_KEY":         os.environ.get("SSM_JWT_SECRET_KEY"),
        # Admin/master password — used only by migrate.py (CREATE DATABASE,
        # `alembic upgrade head`), never by the running application.
        "DB_PASSWORD":            os.environ.get("SSM_DB_PASSWORD"),
        # Least-privilege fastspec_app role password — used by
        # backend/database.py for the app's own runtime connection, and by
        # the fastspec_app-role migration to create/rotate the role itself.
        "FASTSPEC_APP_DB_PASSWORD": os.environ.get("SSM_FASTSPEC_APP_DB_PASSWORD"),
        "OIDC_CLIENT_ID":         os.environ.get("SSM_OIDC_CLIENT_ID"),
        "OIDC_CLIENT_SECRET":     os.environ.get("SSM_OIDC_CLIENT_SECRET"),
    }

    _names = [v for v in _secret_params.values() if v]
    if _names:
        _resp = _ssm.get_parameters(Names=_names, WithDecryption=True)
        _by_name = {p["Name"]: p["Value"] for p in _resp["Parameters"]}
        for env_key, param_name in _secret_params.items():
            if param_name and param_name in _by_name:
                os.environ[env_key] = _by_name[param_name]
except Exception:
    pass  # Never crash the Lambda due to a secret-fetch error

# ── Cold-start: write timestamp to SSM so WakeStack knows Lambda is alive ─────
try:
    _ssm_param = os.environ.get("SSM_WAKE_PARAM")
    if _ssm_param:
        boto3.client("ssm").put_parameter(
            Name=_ssm_param,
            Value=str(datetime.now(UTC).timestamp()),
            Type="String",
            Overwrite=True,
        )
except Exception:
    pass

from mangum import Mangum  # noqa: E402 — must come after env injection

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
