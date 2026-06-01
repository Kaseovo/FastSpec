import json
import os
import time
import boto3

_wake_secret = None
COOLDOWN_SECONDS = 60 * 60  # 60 minutes


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


def is_on_cooldown():
    """Returns True if the environment was woken up within the last 60 minutes."""
    ssm = boto3.client('ssm')
    param_name = f"/{os.environ['ENV']}/fastspec/wake-last-triggered"
    try:
        resp = ssm.get_parameter(Name=param_name)
        last_triggered = float(resp['Parameter']['Value'])
        return (time.time() - last_triggered) < COOLDOWN_SECONDS
    except ssm.exceptions.ParameterNotFound:
        return False


def record_trigger():
    """Stamp the current time so cooldown can be checked on subsequent calls."""
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

    # Cooldown check — environment stays alive for 60 min after wake, no need to re-trigger
    if is_on_cooldown():
        return cors_response(202, json.dumps({'status': 'already_waking'}))

    record_trigger()

    cluster = os.environ['CLUSTER_NAME']
    service = os.environ['SERVICE_NAME']
    rds_id  = os.environ['RDS_INSTANCE_ID']

    # Start RDS if stopped
    rds = boto3.client('rds')
    try:
        resp = rds.describe_db_instances(DBInstanceIdentifier=rds_id)
        status = resp['DBInstances'][0]['DBInstanceStatus']
        if status == 'stopped':
            rds.start_db_instance(DBInstanceIdentifier=rds_id)
            print(f"RDS {rds_id} start requested")
        else:
            print(f"RDS {rds_id} already in state: {status}")
    except Exception as e:
        print(f"RDS error: {e}")

    # Set ECS desired count to 1
    ecs = boto3.client('ecs')
    try:
        ecs.update_service(cluster=cluster, service=service, desiredCount=1)
        print(f"ECS service {service} desired count set to 1")
    except Exception as e:
        print(f"ECS error: {e}")

    return cors_response(200, json.dumps({'status': 'starting'}))
