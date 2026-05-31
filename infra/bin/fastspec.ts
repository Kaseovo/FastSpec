#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { resolveEnv, getConfig } from '../lib/config';
import { DataStack } from '../lib/data-stack';
import { ComputeStack } from '../lib/compute-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { FrontendStack } from '../lib/frontend-stack';

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
  redisEndpoint: dataStack.redisEndpoint,
  env: awsEnv,
});

if (config.deployFrontend) {
  // ACM certificate must live in us-east-1 for CloudFront
  const certStack = new CertificateStack(app, `FastSpec-Cert-${env}`, {
    config,
    env: { account: awsEnv.account, region: 'us-east-1' },
    crossRegionReferences: true,
  });

  new FrontendStack(app, `FastSpec-Frontend-${env}`, {
    config,
    certificate: certStack.certificate,
    albDnsName: computeStack.alb.loadBalancerDnsName,
    // hostedZone omitted — FrontendStack performs HostedZone.fromLookup at synth
    env: awsEnv,
    crossRegionReferences: true,
  });
}
