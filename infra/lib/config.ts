import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export type Env = 'local' | 'prod';

export interface EnvConfig {
  /** The Deployment Environment name. */
  env: Env;
  /** Public domain for this environment. */
  domain: string;
  /** Whether S3 + CloudFront stacks should be deployed (false for local). */
  deployFrontend: boolean;
  /** Override AWS endpoint (floci). Only set for the local environment. */
  awsEndpoint?: string;
  /**
   * Route 53 hosted zone holding `domain`. When set, stacks reference it
   * directly; when omitted they look it up by name at synth time, which
   * needs AWS credentials.
   */
  hostedZoneId?: string;
  /** Name of that hosted zone, when it isn't `domain` itself (e.g. the apex). */
  hostedZoneName?: string;
}

/**
 * Deployment-specific values. Nothing about a particular deployment lives in
 * the code: pass them as CDK context (`--context domain=…`) or environment
 * variables (FASTSPEC_DOMAIN, HOSTED_ZONE_ID, HOSTED_ZONE_NAME) — the deploy
 * workflow sets the latter from GitHub repository variables.
 */
export interface DeploymentSettings {
  domain?: string;
  hostedZoneId?: string;
  hostedZoneName?: string;
}

/**
 * Return the typed config for a Deployment Environment.
 * Throws for unknown environments, and for prod without a domain, so
 * misconfiguration surfaces early.
 */
export function getConfig(env: Env, settings: DeploymentSettings = {}): EnvConfig {
  switch (env) {
    case 'prod': {
      if (!settings.domain) {
        throw new Error(
          'Missing domain for env=prod. Pass --context domain=<your domain> ' +
            'or set FASTSPEC_DOMAIN.',
        );
      }
      return {
        env: 'prod',
        domain: settings.domain,
        deployFrontend: true,
        hostedZoneId: settings.hostedZoneId,
        hostedZoneName: settings.hostedZoneName,
      };
    }
    case 'local':
      return {
        env: 'local',
        domain: 'localhost',
        deployFrontend: false,
        awsEndpoint: 'http://localhost:4566',
      };
    default:
      throw new Error(`Unknown deployment environment: "${env}". Valid values: local, prod.`);
  }
}

/** Read deployment settings from CDK context, falling back to env vars. */
export function resolveDeploymentSettings(node: cdk.App): DeploymentSettings {
  const read = (contextKey: string, envVar: string): string | undefined =>
    (node.node.tryGetContext(contextKey) as string | undefined) || process.env[envVar] || undefined;
  return {
    domain: read('domain', 'FASTSPEC_DOMAIN'),
    hostedZoneId: read('hostedZoneId', 'HOSTED_ZONE_ID'),
    hostedZoneName: read('hostedZoneName', 'HOSTED_ZONE_NAME'),
  };
}

/**
 * Read the `env` CDK context value and return a validated Env token.
 * Usage: cdk deploy --context env=prod
 */
export function resolveEnv(node: cdk.App): Env {
  const raw: unknown = node.node.tryGetContext('env');
  if (raw === undefined || raw === null) {
    throw new Error('Missing required CDK context variable "env". Pass --context env=local|prod.');
  }
  const valid: Env[] = ['local', 'prod'];
  if (!valid.includes(raw as Env)) {
    throw new Error(`Invalid CDK context "env": "${raw}". Valid values: ${valid.join(', ')}.`);
  }
  return raw as Env;
}

/** The hosted zone for `config.domain`, referenced by ID when known. */
export function hostedZoneFor(scope: Construct, config: EnvConfig): route53.IHostedZone {
  const zoneName = config.hostedZoneName ?? config.domain;
  if (config.hostedZoneId) {
    return route53.HostedZone.fromHostedZoneAttributes(scope, 'HostedZone', {
      hostedZoneId: config.hostedZoneId,
      zoneName,
    });
  }
  return route53.HostedZone.fromLookup(scope, 'HostedZone', { domainName: zoneName });
}
