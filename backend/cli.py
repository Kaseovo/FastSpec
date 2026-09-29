"""
FastSpec command line for self-hosted instances.

    python cli.py serve                           # migrate, then run the server
    python cli.py migrate                         # apply database migrations
    python cli.py transfer-local-data --to EMAIL  # none → oidc hand-over

(The hosted AWS deployment migrates by invoking its Lambda with
{"migrate": true} — see lambda_handler.py.)
"""

import argparse
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))


def migrate() -> None:
    from alembic.config import Config

    from alembic import command

    config = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    config.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    command.upgrade(config, "head")


def serve(host: str, port: int, workers: int) -> None:
    import uvicorn

    migrate()
    uvicorn.run(
        "app:application",
        host=host,
        port=port,
        workers=workers,
        proxy_headers=True,
        forwarded_allow_ips=os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1"),
        app_dir=BACKEND_DIR,
    )


def transfer_local_data(to_email: str) -> int:
    from auth.users import transfer_local_data as transfer
    from database import SessionLocal

    db = SessionLocal()
    try:
        result = transfer(db, to_email)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()
    print(
        f"Moved {result.specs} spec(s) and {result.rulesets} lint ruleset(s) to "
        f"{to_email}; revoked {result.revoked_api_keys} local API key(s)."
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="fastspec")
    sub = parser.add_subparsers(dest="command", required=True)

    serve_p = sub.add_parser("serve", help="apply migrations, then run the server")
    serve_p.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    serve_p.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")))
    serve_p.add_argument(
        "--workers", type=int, default=int(os.environ.get("WEB_CONCURRENCY", "1"))
    )

    sub.add_parser("migrate", help="apply database migrations")

    transfer_p = sub.add_parser(
        "transfer-local-data",
        help="move the single-user (AUTH_MODE=none) data to a signed-in account",
    )
    transfer_p.add_argument("--to", required=True, metavar="EMAIL")

    args = parser.parse_args(argv)
    if args.command == "serve":
        serve(args.host, args.port, args.workers)
    elif args.command == "migrate":
        migrate()
    elif args.command == "transfer-local-data":
        return transfer_local_data(args.to)
    return 0


if __name__ == "__main__":
    sys.exit(main())
