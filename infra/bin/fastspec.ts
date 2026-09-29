#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { resolveEnv, getConfig, resolveDeploymentSettings } from '../lib/config';
import { LambdaStack } from '../lib/lambda-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();
const env = resolveEnv(app);
const config = getConfig(env, resolveDeploymentSettings(app));

// Use CDK default account/region for environment-aware stacks
const awsEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// No database stack: the database is a serverless Postgres outside AWS,
// reached through the DATABASE_URL in SSM (docs/adr/0009-serverless-postgres.md).
const lambdaStack = new LambdaStack(app, `FastSpec-Lambda-${env}`, {
  config,
  env: awsEnv,
});

if (config.deployFrontend) {
  // ACM certificate must live in us-east-1 for CloudFront.
  // The stack provisions/renews the cert; FrontendStack imports it by ARN
  // to avoid CDK CrossRegionExportWriter churn.
  new CertificateStack(app, `FastSpec-Cert-${env}`, {
    config,
    env: { account: awsEnv.account, region: 'us-east-1' },
  });

  // certificateArn is read from CDK context, populated by the CI after deploying
  // CertStack: cdk deploy ... --context certificateArn=<arn>
  // A placeholder is used at synth time when deploying other stacks (e.g. LambdaStack)
  // so the app synthesises cleanly. CloudFormation will reject an invalid ARN at
  // deploy time if FrontendStack is actually targeted without the real value.
  const certificateArn: string =
    app.node.tryGetContext('certificateArn') ?? 'CERTIFICATE_ARN_REQUIRED';

  new FrontendStack(app, `FastSpec-Frontend-${env}`, {
    config,
    certificateArn,
    lambdaFunctionUrl: lambdaStack.functionUrl,
    // hostedZone omitted — FrontendStack resolves it from the config
    env: awsEnv,
  });
}
