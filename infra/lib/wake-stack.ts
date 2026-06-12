import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface WakeStackProps extends cdk.StackProps {
  config: EnvConfig;
  rdsInstanceId: string;
}

/**
 * WakeStack — Lambda Function URL that starts the environment on demand.
 *
 * Validates a shared secret before touching RDS.
 * The IAM role is scoped to start-only operations — no stop, no other access.
 *
 * Also provisions an auto-stop Lambda that runs on a 30-minute schedule and
 * stops RDS after 2 hours of inactivity (no wake requests).
 */
export class WakeStack extends cdk.Stack {
  /** Public URL to POST to in order to wake the environment. */
  readonly functionUrl: string;

  constructor(scope: Construct, id: string, props: WakeStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ── Wake Lambda (on-demand RDS start) ────────────────────────────────────
    const fn = new lambda.Function(this, 'WakeFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/wake')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        ENV: config.env,
        RDS_INSTANCE_ID: props.rdsInstanceId,
      },
    });

    // Read wake secret + cooldown timestamp from SSM; write cooldown timestamp
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:PutParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/${config.env}/fastspec/wake-secret`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/${config.env}/fastspec/wake-last-triggered`,
      ],
    }));

    // Start RDS only — no stop
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds:DescribeDBInstances', 'rds:StartDBInstance'],
      resources: ['*'],
    }));

    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: [`https://${config.domain}`],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['Content-Type'],
      },
    });

    this.functionUrl = fnUrl.url;

    new cdk.CfnOutput(this, 'WakeFunctionUrl', {
      value: fnUrl.url,
      exportName: `${this.stackName}-WakeFunctionUrl`,
    });

    // ── Auto-stop Lambda (scheduled RDS stop after inactivity) ───────────────
    const autoStopCode = [
      'import os',
      'import time',
      'import boto3',
      '',
      'INACTIVITY_SECONDS = 2 * 60 * 60  # 2 hours',
      '',
      '',
      'def handler(event, context):',
      '    env = os.environ["ENV"]',
      '    rds_id = os.environ["RDS_INSTANCE_ID"]',
      '',
      '    ssm = boto3.client("ssm")',
      '    param_name = f"/{env}/fastspec/wake-last-triggered"',
      '    try:',
      '        resp = ssm.get_parameter(Name=param_name)',
      '        last_triggered = float(resp["Parameter"]["Value"])',
      '    except Exception as e:',
      '        print(f"Could not read SSM parameter: {e}")',
      '        return',
      '',
      '    elapsed = time.time() - last_triggered',
      '    if elapsed <= INACTIVITY_SECONDS:',
      '        print(f"RDS active within last 2 hours ({elapsed:.0f}s ago). Skipping stop.")',
      '        return',
      '',
      '    rds = boto3.client("rds")',
      '    try:',
      '        resp = rds.describe_db_instances(DBInstanceIdentifier=rds_id)',
      '        status = resp["DBInstances"][0]["DBInstanceStatus"]',
      '    except Exception as e:',
      '        print(f"Error describing RDS instance: {e}")',
      '        return',
      '',
      '    if status == "available":',
      '        rds.stop_db_instance(DBInstanceIdentifier=rds_id)',
      '        print(f"RDS {rds_id} stop requested after {elapsed:.0f}s of inactivity")',
      '    else:',
      '        print(f"RDS {rds_id} is in state \'{status}\', skipping stop")',
    ].join('\n');

    const autoStopFn = new lambda.Function(this, 'AutoStopFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromInline(autoStopCode),
      timeout: cdk.Duration.seconds(30),
      environment: {
        ENV: config.env,
        RDS_INSTANCE_ID: props.rdsInstanceId,
      },
    });

    // Read wake-last-triggered timestamp from SSM
    autoStopFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/${config.env}/fastspec/wake-last-triggered`,
      ],
    }));

    // Describe + stop RDS
    autoStopFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds:DescribeDBInstances', 'rds:StopDBInstance'],
      resources: ['*'],
    }));

    // Trigger every 30 minutes
    const autoStopRule = new events.Rule(this, 'AutoStopSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
    });
    autoStopRule.addTarget(new events_targets.LambdaFunction(autoStopFn));
  }
}
