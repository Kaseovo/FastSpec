"""Alembic environment configuration for FastSpec.

DATABASE_URL is read from the environment variable of the same name, falling
back to the value in alembic.ini when not set.  This allows the same config to
work both locally (via alembic CLI) and in CI/CD pipelines where the URL is
injected via the environment.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# ---------------------------------------------------------------------------
# Make sure the backend package is importable when running alembic from the
# backend/ directory.
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Base (and all models so their tables are registered on the metadata).
import models  # noqa: E402, F401 – registers all ORM classes on Base.metadata
from base import Base  # noqa: E402
from database import DATABASE_URL as _assembled_db_url  # noqa: E402

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Override sqlalchemy.url: prefer DATABASE_URL env var, then the value assembled
# in database.py from DB_ENDPOINT + DB_PASSWORD (used in ECS deployments where
# no single DATABASE_URL env var is injected).
database_url = os.environ.get("DATABASE_URL") or _assembled_db_url
if database_url:
    # set_main_option goes through configparser interpolation, where "%" is
    # special — and URL-encoded passwords contain it.
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
