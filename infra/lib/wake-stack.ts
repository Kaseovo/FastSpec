import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface WakeStackProps extends cdk.StackProps {
  config: EnvConfig;
  clusterName: string;
  serviceName: string;
  rdsInstanceId: string;
}

/**
 * WakeStack — Lambda Function URL that starts the dev environment on demand.
 *
 * Validates a shared secret before touching RDS or ECS.
 * The IAM role is scoped to start-only operations — no stop, no other access.
 */
export class WakeStack extends cdk.Stack {
  /** Public URL to POST to in order to wake the environment. */
  readonly functionUrl: string;

  constructor(scope: Construct, id: string, props: WakeStackProps) {
    super(scope, id, props);

    const { config } = props;

    const fn = new lambda.Function(this, 'WakeFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/wake')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        ENV: config.env,
        CLUSTER_NAME: props.clusterName,
        SERVICE_NAME: props.serviceName,
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

    // Update ECS service desired count — scoped to start (desiredCount=1)
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecs:UpdateService', 'ecs:DescribeServices'],
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
  }
}
