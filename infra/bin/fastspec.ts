#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { resolveEnv, getConfig } from '../lib/config';
import { DataStack } from '../lib/data-stack';
import { ComputeStack } from '../lib/compute-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { WakeStack } from '../lib/wake-stack';

const app = new cdk.App();
const env = resolveEnv(app);
const config = getConfig(env);

// Use CDK default account/region for environment-aware stacks
const awsEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const dataStack = new DataStack(app, `FastSpec-Data-${env}`, { config, env: awsEnv });

const computeStack = new ComputeStack(app, `FastSpec-Compute-${env}`, {
  config,
  vpc: dataStack.vpc,
  dbEndpoint: dataStack.dbEndpoint,
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
  // A placeholder is used at synth time when deploying other stacks (e.g. DataStack)
  // so the app synthesises cleanly. CloudFormation will reject an invalid ARN at
  // deploy time if FrontendStack is actually targeted without the real value.
  const certificateArn: string =
    app.node.tryGetContext('certificateArn') ?? 'CERTIFICATE_ARN_REQUIRED';

  new FrontendStack(app, `FastSpec-Frontend-${env}`, {
    config,
    certificateArn,
    albDnsName: computeStack.alb.loadBalancerDnsName,
    // hostedZone omitted — FrontendStack performs HostedZone.fromLookup at synth
    env: awsEnv,
  });

  new WakeStack(app, `FastSpec-Wake-${env}`, {
    config,
    clusterName: computeStack.cluster.clusterName,
    serviceName: computeStack.serviceName,
    mcpServiceName: computeStack.mcpServiceName,
    rdsInstanceId: dataStack.rdsInstanceId,
    env: awsEnv,
  });
}
