import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface LambdaStackProps extends cdk.StackProps {
  config: EnvConfig;
  /** RDS endpoint (host:port) from DataStack. */
  dbEndpoint: string;
}

/**
 * LambdaStack — FastAPI backend as a Docker-image Lambda with a public Function URL.
 *
 * Replaces the Fargate-based ComputeStack. The function runs outside a VPC and
 * reaches the now-publicly-accessible RDS instance over the internet.
 *
 * Secrets are loaded via SSM dynamic references so no plaintext appears in the
 * CloudFormation template. The execution role is granted `ssm:PutParameter`
 * on the wake-last-triggered parameter (used by the WakeStack mechanism).
 */
export class LambdaStack extends cdk.Stack {
  /** Full Lambda Function URL (https://…). Consumed by FrontendStack. */
  readonly functionUrl: string;
  /** Lambda function ARN. */
  readonly functionArn: string;
  /** Lambda function name. Consumed by WakeStack. */
  readonly functionName: string;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { config } = props;
    const env = config.env;

    // Resolve SSM secrets via CloudFormation dynamic references.
    // Parameters are expected to exist in Parameter Store before deployment.
    const jwtSecretKey = ssm.StringParameter.valueForStringParameter(
      this,
      `/${env}/fastspec/secret-key`,
    );
    const dbPassword = ssm.StringParameter.valueForStringParameter(
      this,
      `/${env}/fastspec/db-password`,
    );
    const googleClientId = ssm.StringParameter.valueForStringParameter(
      this,
      `/${env}/fastspec/google-client-id`,
    );

    // ── Lambda Docker Function ─────────────────────────────────────────────────
    const fn = new lambda.DockerImageFunction(this, 'BackendFn', {
      code: lambda.DockerImageCode.fromImageAsset('../backend', {
        file: 'Dockerfile.lambda',
      }),
      memorySize: 512,
      timeout: cdk.Duration.minutes(2),
      environment: {
        DB_ENDPOINT: props.dbEndpoint,
        ENV: env,
        FRONTEND_URL: `https://${config.domain}`,
        CORS_ORIGINS: `https://${config.domain}`,
        SSM_WAKE_PARAM: `/${env}/fastspec/wake-last-triggered`,
        JWT_SECRET_KEY: jwtSecretKey,
        DB_PASSWORD: dbPassword,
        GOOGLE_CLIENT_ID: googleClientId,
      },
    });

    // ── IAM: allow Lambda to record the last-wake timestamp in SSM ────────────
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:PutParameter'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/${env}/fastspec/wake-last-triggered`,
        ],
      }),
    );

    // ── Function URL (unauthenticated, CORS locked to the app domain) ─────────
    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: [`https://${config.domain}`],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ['*'],
      },
    });

    this.functionUrl = fnUrl.url;
    this.functionArn = fn.functionArn;
    this.functionName = fn.functionName;

    // ── Stack Outputs ─────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'LambdaFunctionUrl', {
      value: fnUrl.url,
      exportName: `${this.stackName}-LambdaFunctionUrl`,
      description: 'Lambda Function URL for the FastSpec backend',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: fn.functionArn,
      exportName: `${this.stackName}-LambdaFunctionArn`,
      description: 'Lambda function ARN',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: fn.functionName,
      exportName: `${this.stackName}-LambdaFunctionName`,
      description: 'Lambda function name — consumed by WakeStack',
    });
  }
}
