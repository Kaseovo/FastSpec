import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
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
 * Secrets (JWT_SECRET_KEY, DB_PASSWORD, GOOGLE_CLIENT_ID) are stored as
 * SecureString parameters in SSM Parameter Store under /{env}/fastspec/*.
 * Their *names* are passed as env vars; the Lambda fetches the values via
 * boto3 at cold start — no plaintext in CloudFormation or the Lambda console.
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
    const ssmPrefix = `/${env}/fastspec`;

    // ── Lambda Docker Function ─────────────────────────────────────────────────
    const fn = new lambda.DockerImageFunction(this, 'BackendFn', {
      code: lambda.DockerImageCode.fromImageAsset('..', {
        file: 'backend/Dockerfile.lambda',
      }),
      memorySize: 512,
      timeout: cdk.Duration.minutes(2),
      environment: {
        DB_ENDPOINT: props.dbEndpoint,
        ENV: env,
        FRONTEND_URL: `https://${config.domain}`,
        CORS_ORIGINS: `https://${config.domain}`,
        // OAuth redirect flow: Google sends the browser back through CloudFront
        // (/auth* behavior) so cookies and the callback share the app domain.
        GOOGLE_REDIRECT_URI: `https://${config.domain}/auth/google/callback`,
        SSM_WAKE_PARAM: `${ssmPrefix}/wake-last-triggered`,
        // Secret *names* only — values are fetched via boto3 at cold start.
        SSM_JWT_SECRET_KEY:  `${ssmPrefix}/secret-key`,
        SSM_DB_PASSWORD:     `${ssmPrefix}/db-password`,
        SSM_GOOGLE_CLIENT_ID:`${ssmPrefix}/google-client-id`,
        SSM_GOOGLE_CLIENT_SECRET: `${ssmPrefix}/google-client-secret`,
      },
    });

    // ── IAM: allow Lambda to read secrets + write wake timestamp ──────────────
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter${ssmPrefix}/*`,
        ],
      }),
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:PutParameter'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter${ssmPrefix}/wake-last-triggered`,
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
