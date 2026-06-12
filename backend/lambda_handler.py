"""AWS Lambda entry point for the merged FastSpec + MCP ASGI application.

Cold-start behaviour:
  - On each cold start, writes the current UTC timestamp to the SSM parameter
    named by SSM_WAKE_PARAM (used by the WakeStack RDS idle timer so the stack
    knows the Lambda is alive and keeps RDS warm).
  - Errors from SSM are silently swallowed — a missing env var or IAM permission
    must never crash the handler.

Invocation modes:
  - {"migrate": true}  → runs database creation + Alembic upgrade head,
                         returns {"statusCode": 200} on success, raises on failure.
  - anything else      → dispatches to the merged FastAPI + MCP ASGI app via Mangum.

Handler export: ``lambda_handler.handler``
"""

import os
from datetime import datetime, timezone

from mangum import Mangum

from app import application

# ── Cold-start: write timestamp to SSM so WakeStack knows Lambda is alive ────
try:
    _ssm_param = os.environ.get("SSM_WAKE_PARAM")
    if _ssm_param:
        import boto3

        boto3.client("ssm").put_parameter(
            Name=_ssm_param,
            Value=datetime.now(timezone.utc).isoformat(),
            Type="String",
            Overwrite=True,
        )
except Exception:
    pass  # A missing env var or boto3 error must never crash the Lambda

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

    # Step 2 — run Alembic migrations
    proc = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"alembic upgrade head failed with exit code {proc.returncode}"
        )
