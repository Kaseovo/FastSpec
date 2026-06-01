import * as cdk from 'aws-cdk-lib';

export type Env = 'local' | 'dev' | 'staging' | 'prod';

export interface EnvConfig {
  /** The Deployment Environment name. */
  env: Env;
  /** Public domain for this environment. */
  domain: string;
  /** Whether S3 + CloudFront stacks should be deployed (false for local). */
  deployFrontend: boolean;
  /** Override AWS endpoint (floci). Only set for the local environment. */
  awsEndpoint?: string;
}

const CONFIGS: Record<Env, EnvConfig> = {
  prod: {
    env: 'prod',
    domain: 'fastspec.kaseovo.com',
    deployFrontend: true,
  },
  staging: {
    env: 'staging',
    domain: 'staging.fastspec.kaseovo.com',
    deployFrontend: true,
  },
  dev: {
    env: 'dev',
    domain: 'dev.fastspec.kaseovo.com',
    deployFrontend: true,
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
