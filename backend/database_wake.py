"""Waking a database that sleeps when idle.

The AWS deployment stops its RDS instance after two hours without activity,
to save costs (WakeStack's auto-stop, docs/DEPLOYMENT.md). This is the
backend's side of it:

- ``note_activity()`` refreshes the idle timer's timestamp — at most every
  few minutes — so the database isn't stopped while people use the app;
- ``request_start()`` starts the instance when a request finds the database
  unreachable, so people see "waking up" instead of an error and never need
  to know about the wake page.

Both do nothing unless the deployment sets SSM_WAKE_PARAM / RDS_INSTANCE_ID:
self-hosted databases don't sleep. Neither ever raises — failing to note
activity or to start the database must not fail the request.
"""

import logging
import os
import threading
import time
from datetime import UTC, datetime

logger = logging.getLogger(__name__)

ACTIVITY_INTERVAL_SECONDS = 5 * 60
START_CHECK_INTERVAL_SECONDS = 20

_lock = threading.Lock()
_last_activity: float | None = None
_last_start_check: float | None = None


def _client(service: str):
    import boto3
    from botocore.config import Config

    # Called while answering a request: fail fast rather than hold it up.
    config = Config(connect_timeout=2, read_timeout=5, retries={"total_max_attempts": 2})
    return boto3.client(service, config=config)


def _due(last: float | None, interval: float) -> bool:
    return last is None or time.monotonic() - last >= interval


def can_start() -> bool:
    """Whether this deployment starts its database on demand."""
    return bool(os.environ.get("RDS_INSTANCE_ID"))


def note_activity() -> None:
    """Tell the idle timer the app is in use."""
    global _last_activity
    name = os.environ.get("SSM_WAKE_PARAM")
    if not name:
        return
    with _lock:
        if not _due(_last_activity, ACTIVITY_INTERVAL_SECONDS):
            return
        _last_activity = time.monotonic()
    try:
        _client("ssm").put_parameter(
            Name=name,
            Value=str(datetime.now(UTC).timestamp()),
            Type="String",
            Overwrite=True,
        )
    except Exception as exc:
        logger.warning("Could not update %s: %s", name, exc)


def request_start() -> None:
    """Start the database instance if it's stopped.

    Checked at most every START_CHECK_INTERVAL_SECONDS: while the database
    starts, every request fails and the app polls /health/ready.
    A database that is still stopping is started by a later check.
    """
    global _last_start_check
    instance = os.environ.get("RDS_INSTANCE_ID")
    if not instance:
        return
    with _lock:
        if not _due(_last_start_check, START_CHECK_INTERVAL_SECONDS):
            return
        _last_start_check = time.monotonic()
    try:
        rds = _client("rds")
        described = rds.describe_db_instances(DBInstanceIdentifier=instance)
        status = described["DBInstances"][0]["DBInstanceStatus"]
        if status == "stopped":
            rds.start_db_instance(DBInstanceIdentifier=instance)
            logger.warning("Database %s was stopped; starting it", instance)
    except Exception as exc:
        logger.warning("Could not start database %s: %s", instance, exc)
