import json
import os
import time
import boto3

_wake_secret = None


def get_wake_secret():
    global _wake_secret
    if _wake_secret is None:
        ssm = boto3.client('ssm')
        resp = ssm.get_parameter(
            Name=f"/{os.environ['ENV']}/fastspec/wake-secret",
            WithDecryption=True,
        )
        _wake_secret = resp['Parameter']['Value']
    return _wake_secret


def record_trigger():
    """Stamp the current time: the auto-stop Lambda leaves the database
    running for two hours after the last wake-up or backend activity."""
    ssm = boto3.client('ssm')
    ssm.put_parameter(
        Name=f"/{os.environ['ENV']}/fastspec/wake-last-triggered",
        Value=str(time.time()),
        Type='String',
        Overwrite=True,
    )


def cors_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json',
        },
        'body': body,
    }


def handler(event, context):
    method = event.get('requestContext', {}).get('http', {}).get('method', '')

    if method == 'OPTIONS':
        return cors_response(200, '')

    if method != 'POST':
        return cors_response(405, json.dumps({'error': 'Method not allowed'}))

    # Validate secret
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return cors_response(400, json.dumps({'error': 'Invalid JSON'}))

    if body.get('secret') != get_wake_secret():
        return cors_response(401, json.dumps({'error': 'Unauthorized'}))

    record_trigger()

    # Always look at the instance itself: the timestamp above is also written
    # by the backend, so it can be recent while the database is stopped.
    rds_id = os.environ['RDS_INSTANCE_ID']
    rds = boto3.client('rds')
    try:
        resp = rds.describe_db_instances(DBInstanceIdentifier=rds_id)
        status = resp['DBInstances'][0]['DBInstanceStatus']
        if status == 'stopped':
            rds.start_db_instance(DBInstanceIdentifier=rds_id)
            print(f"RDS {rds_id} start requested")
            return cors_response(200, json.dumps({'status': 'starting'}))
    except Exception as e:
        print(f"RDS error: {e}")
        return cors_response(502, json.dumps({'error': 'Could not start the database'}))

    # Starting, available — or still stopping, in which case the backend
    # starts it once stopped, when the wake page's readiness polls reach it.
    print(f"RDS {rds_id} already in state: {status}")
    return cors_response(202, json.dumps({'status': status}))
