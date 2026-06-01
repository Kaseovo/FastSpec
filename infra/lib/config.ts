import * as cdk from 'aws-cdk-lib';

export type Env = 'local' | 'dev' | 'staging' | 'prod';

export interface EnvConfig {
  /** The Deployment Environment name. */
  env: Env;
  /** Public domain for this environment. */
  domain: string;
  /** Whether S3 + CloudFront stacks should be deployed (false for local). */
  deployFrontend: boolean;
  /**
   * ARN of the ACM certificate in us-east-1 used by CloudFront.
   * Required when deployFrontend is true.
   * Obtain by deploying FastSpec-Cert-<env> first, then reading the certificate
   * ARN from the AWS Console (ACM → us-east-1) and setting it here.
   */
  certificateArn?: string;
  /** Override AWS endpoint (floci). Only set for the local environment. */
  awsEndpoint?: string;
}

const CONFIGS: Record<Env, EnvConfig> = {
  prod: {
    env: 'prod',
    domain: 'fastspec.kaseovo.com',
    deployFrontend: true,
    // Run `cdk deploy FastSpec-Cert-prod` first, then set this ARN.
    certificateArn: undefined,
  },
  staging: {
    env: 'staging',
    domain: 'staging.fastspec.kaseovo.com',
    deployFrontend: true,
    certificateArn: undefined,
  },
  dev: {
    env: 'dev',
    domain: 'dev.fastspec.kaseovo.com',
    deployFrontend: true,
    certificateArn: 'arn:aws:acm:us-east-1:000000000000:certificate/00000000-0000-0000-0000-000000000000',
  },
  local: {
    env: 'local',
    domain: 'localhost',
    deployFrontend: false,
    awsEndpoint: 'http://localhost:4566',
  },
};

/**
 * Return the typed config for a Deployment Environment.
 * Throws for unknown environment values so misconfiguration surfaces early.
 */
export function getConfig(env: Env): EnvConfig {
  const config = CONFIGS[env];
  if (!config) {
    throw new Error(`Unknown deployment environment: "${env}". Valid values: local, dev, staging, prod.`);
  }
  return config;
}

/**
 * Read the `env` CDK context value and return a validated Env token.
 * Usage: cdk deploy --context env=prod
 */
export function resolveEnv(node: cdk.App): Env {
  const raw: unknown = node.node.tryGetContext('env');
  if (raw === undefined || raw === null) {
    throw new Error('Missing required CDK context variable "env". Pass --context env=local|dev|staging|prod.');
  }
  const valid: Env[] = ['local', 'dev', 'staging', 'prod'];
  if (!valid.includes(raw as Env)) {
    throw new Error(`Invalid CDK context "env": "${raw}". Valid values: ${valid.join(', ')}.`);
  }
  return raw as Env;
}
