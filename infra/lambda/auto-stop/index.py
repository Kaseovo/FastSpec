"""Auto-stop Lambda — scheduled RDS shutdown after inactivity.

Runs on a 30-minute EventBridge schedule (see WakeStack). Reads the
``wake-last-triggered`` SSM timestamp (written by both the wake Lambda and
the backend Lambda's cold-start hook) and stops the RDS instance once it has
been idle for ``INACTIVITY_SECONDS``.

Previously this was inline Python embedded as a JS string array in
``wake-stack.ts`` — moved to a real file so it can be linted, unit tested,
and reviewed like any other source file (mirrors ``infra/lambda/wake/index.py``).
"""

import os
import time

import boto3

INACTIVITY_SECONDS = 2 * 60 * 60  # 2 hours


def handler(event, context):
    env = os.environ["ENV"]
    rds_id = os.environ["RDS_INSTANCE_ID"]

    ssm = boto3.client("ssm")
    param_name = f"/{env}/fastspec/wake-last-triggered"
    try:
        resp = ssm.get_parameter(Name=param_name)
        last_triggered = float(resp["Parameter"]["Value"])
    except Exception as e:
        print(f"Could not read SSM parameter: {e}")
        return

    elapsed = time.time() - last_triggered
    if elapsed <= INACTIVITY_SECONDS:
        print(f"RDS active within last 2 hours ({elapsed:.0f}s ago). Skipping stop.")
        return

    rds = boto3.client("rds")
    try:
        resp = rds.describe_db_instances(DBInstanceIdentifier=rds_id)
        status = resp["DBInstances"][0]["DBInstanceStatus"]
    except Exception as e:
        print(f"Error describing RDS instance: {e}")
        return

    if status == "available":
        rds.stop_db_instance(DBInstanceIdentifier=rds_id)
        print(f"RDS {rds_id} stop requested after {elapsed:.0f}s of inactivity")
    else:
        print(f"RDS {rds_id} is in state '{status}', skipping stop")
