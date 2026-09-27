import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface WakeStackProps extends cdk.StackProps {
  config: EnvConfig;
  rdsInstanceId: string;
}

/**
 * WakeStack - Lambda Function URL that starts the environment on demand.
 *
 * Validates a shared secret before touching RDS.
 * The IAM role is scoped to start-only operations - no stop, no other access.
 *
 * Also provisions an auto-stop Lambda that runs on a 30-minute schedule and
 * stops RDS after 2 hours of inactivity (no wake requests).
 *
 * Both Lambdas get a basic CloudWatch alarm on `Errors` (this is a small
 * cost-optimization side-stack, not the core product - proportional
 * observability, not a full dashboard) and the auto-stop Lambda's
 * EventBridge target has a DLQ so a failed invocation isn't silently lost
 * (a silent auto-stop failure means an unbounded RDS bill).
 */
export class WakeStack extends cdk.Stack {
  /** Public URL to POST to in order to wake the environment. */
  readonly functionUrl: string;

  constructor(scope: Construct, id: string, props: WakeStackProps) {
    super(scope, id, props);

    const { config } = props;
    const rdsInstanceArn = `arn:aws:rds:${this.region}:${this.account}:db:${props.rdsInstanceId}`;

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

    // Start RDS only - no stop. Scoped to this environment's RDS instance,
    // not '*' (rds:DescribeDBInstances has no resource-level permissions in
    // IAM, so it must stay '*'; StartDBInstance is scoped).
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds:DescribeDBInstances'],
      resources: ['*'],
    }));
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds:StartDBInstance'],
      resources: [rdsInstanceArn],
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
    // Code lives in infra/lambda/auto-stop/index.py - matches how the wake
    // Lambda is organized (a real, lintable, unit-testable file rather than
    // an inline JS string array of Python).
    const autoStopFn = new lambda.Function(this, 'AutoStopFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/auto-stop')),
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

    // Describe (no resource-level IAM support, stays '*') + stop (scoped to
    // this environment's RDS instance ARN) RDS.
    autoStopFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds:DescribeDBInstances'],
      resources: ['*'],
    }));
    autoStopFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds:StopDBInstance'],
      resources: [rdsInstanceArn],
    }));

    // Dead-letter queue for the EventBridge target: if the auto-stop Lambda
    // fails all its retries, the failed event lands here instead of
    // vanishing silently - a failed auto-stop is otherwise an invisible
    // ongoing RDS bill.
    const autoStopDlq = new sqs.Queue(this, 'AutoStopDlq', {
      retentionPeriod: cdk.Duration.days(14),
    });

    // Trigger every 30 minutes
    const autoStopRule = new events.Rule(this, 'AutoStopSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
    });
    autoStopRule.addTarget(new events_targets.LambdaFunction(autoStopFn, {
      deadLetterQueue: autoStopDlq,
      retryAttempts: 2,
    }));

    // ── Alarms (proportional - errors only, no dashboards/tracing) ───────────
    new cloudwatch.Alarm(this, 'WakeFnErrorsAlarm', {
      alarmDescription: 'Wake Lambda returned one or more errors in a 5-minute window.',
      metric: fn.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cloudwatch.Alarm(this, 'AutoStopFnErrorsAlarm', {
      alarmDescription: 'Auto-stop Lambda returned one or more errors in a 30-minute window ' +
        '(one scheduled run) - a failed auto-stop silently keeps RDS billing.',
      metric: autoStopFn.metricErrors({ period: cdk.Duration.minutes(30) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}
