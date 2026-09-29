"""AWS Lambda entry point for the merged FastSpec + MCP ASGI application.

Cold-start behaviour (only when running inside Lambda): loads secrets from
SSM Parameter Store (SecureString parameters) into os.environ, so the rest of
the application reads them as normal env vars; only their *names* appear in
the Lambda console and CloudFormation:

  - DATABASE_URL        ← SSM_DATABASE_URL (the Postgres connection string,
                          Neon for the hosted version — docs/adr/0009-*.md)
  - JWT_SECRET_KEY      ← SSM_JWT_SECRET_KEY
  - OIDC_CLIENT_ID      ← SSM_OIDC_CLIENT_ID
  - OIDC_CLIENT_SECRET  ← SSM_OIDC_CLIENT_SECRET

Secrets that can't be loaded are logged by name (never by value); the handler
still starts, and the app fails with a clear configuration error if something
it needs is missing.

Invocation modes:
  - {"migrate": true}  → Alembic upgrade head against DATABASE_URL,
                         returns {"statusCode": 200} on success, raises on failure.
  - anything else      → dispatches to the merged FastAPI + MCP ASGI app via Mangum.

Handler export: ``lambda_handler.handler``
"""

import os
import sys
from collections.abc import MutableMapping

# SSM SecureString parameters: env var to set → env var holding the name.
SSM_SECRETS = {
    "DATABASE_URL": "SSM_DATABASE_URL",
    "JWT_SECRET_KEY": "SSM_JWT_SECRET_KEY",
    "OIDC_CLIENT_ID": "SSM_OIDC_CLIENT_ID",
    "OIDC_CLIENT_SECRET": "SSM_OIDC_CLIENT_SECRET",
}


def load_secrets(environ: MutableMapping[str, str], ssm) -> list[str]:
    """Copy secret values into `environ`; return the env vars that couldn't be set."""
    wanted = {env: environ[src] for env, src in SSM_SECRETS.items() if environ.get(src)}
    if not wanted:
        return []
    try:
        response = ssm.get_parameters(Names=list(wanted.values()), WithDecryption=True)
        found = {p["Name"]: p["Value"] for p in response["Parameters"]}
    except Exception:
        found = {}
    missing = []
    for env, name in wanted.items():
        if name in found:
            environ[env] = found[name]
        else:
            missing.append(env)
    return missing


def _cold_start() -> None:
    try:
        import boto3

        missing = load_secrets(os.environ, boto3.client("ssm"))
        if missing:
            print(f"WARNING: could not load secrets: {', '.join(missing)}", file=sys.stderr)
    except Exception as exc:
        print(f"WARNING: loading secrets failed: {exc}", file=sys.stderr)


if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    _cold_start()

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
    """Run ``alembic upgrade head`` against DATABASE_URL.

    In a subprocess: Alembic reconfigures logging, which must not leak into
    the process that goes on serving requests. Raises RuntimeError if the
    command fails.
    """
    import subprocess

    proc = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"alembic upgrade head failed with exit code {proc.returncode}"
        )
