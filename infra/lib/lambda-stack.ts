import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface LambdaStackProps extends cdk.StackProps {
  config: EnvConfig;
}

/**
 * LambdaStack - FastAPI backend as a Docker-image Lambda with a public Function URL.
 *
 * The database is a serverless Postgres outside AWS (Neon for the hosted
 * version — docs/adr/0009-serverless-postgres.md): it costs nothing while
 * idle and resumes by itself on the first connection, so there is no
 * database in this app, and nothing to wake up or stop.
 *
 * Secrets — the database connection string, the JWT signing key and the
 * OIDC client ID/secret — are SecureString parameters in SSM Parameter Store
 * under /{env}/fastspec/*. Their *names* are passed as env vars; the Lambda
 * fetches the values via boto3 at cold start - no plaintext in
 * CloudFormation or the Lambda console.
 */
export class LambdaStack extends cdk.Stack {
  /** Full Lambda Function URL (https://…). Consumed by FrontendStack. */
  readonly functionUrl: string;
  /** Lambda function ARN. */
  readonly functionArn: string;
  /** Lambda function name. */
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
        ENV: env,
        // Public origin: the OIDC redirect URI is derived from it
        // (https://<domain>/auth/oidc/callback), so the provider sends the
        // browser back through CloudFront (/auth* behavior) and cookies and the
        // callback share the app domain. CORS defaults to the same origin.
        PUBLIC_URL: `https://${config.domain}`,
        // Sign-in via Google, through the generic OIDC flow
        // (docs/adr/0006-auth-modes.md).
        AUTH_MODE: 'oidc',
        OIDC_ISSUER: 'https://accounts.google.com',
        // Secret *names* only - values are fetched via boto3 at cold start.
        SSM_DATABASE_URL: `${ssmPrefix}/database-url`,
        SSM_JWT_SECRET_KEY: `${ssmPrefix}/secret-key`,
        // Parameter names predate the move to generic OIDC; the values are
        // the Google OAuth client's ID and secret.
        SSM_OIDC_CLIENT_ID: `${ssmPrefix}/google-client-id`,
        SSM_OIDC_CLIENT_SECRET: `${ssmPrefix}/google-client-secret`,
      },
    });

    // ── IAM: read this environment's secrets, nothing else ────────────────────
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter${ssmPrefix}/*`,
        ],
      }),
    );

    // ── Function URL (unauthenticated) ────────────────────────────────────────
    // Only CloudFront calls it, from the app's own origin. No CORS settings
    // here: the app answers CORS itself (CORS_ORIGINS), and a second
    // Access-Control-Allow-Origin header makes browsers reject the response.
    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
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
      description: 'Lambda function name - invoked by the deploy workflow to migrate',
    });
  }
}
