import * as cdk from 'aws-cdk-lib';
import { getConfig, hostedZoneFor, resolveDeploymentSettings } from '../lib/config';

describe('getConfig', () => {
  test('prod uses the deployment domain and deploys the frontend', () => {
    const config = getConfig('prod', { domain: 'specs.example.com', hostedZoneId: 'Z123' });
    expect(config.env).toBe('prod');
    expect(config.domain).toBe('specs.example.com');
    expect(config.hostedZoneId).toBe('Z123');
    expect(config.deployFrontend).toBe(true);
    expect(config.awsEndpoint).toBeUndefined();
    expect(config.externalDns).toBe(false);
  });

  test('prod can leave DNS to another provider', () => {
    expect(getConfig('prod', { domain: 'specs.example.com', externalDns: true }).externalDns).toBe(true);
  });

  test('prod without a domain throws a descriptive error', () => {
    expect(() => getConfig('prod')).toThrow(/--context domain=/);
  });

  test('local targets localhost with no frontend deployment and floci endpoint', () => {
    const config = getConfig('local');
    expect(config.env).toBe('local');
    expect(config.domain).toBe('localhost');
    expect(config.deployFrontend).toBe(false);
    expect(config.awsEndpoint).toBe('http://localhost:4566');
  });

  test('unknown env value throws a descriptive error', () => {
    expect(() => getConfig('noop' as any)).toThrow(/Unknown deployment environment/);
  });
});

describe('resolveDeploymentSettings', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    // The deploy workflow sets these for every step, tests included.
    for (const name of ['FASTSPEC_DOMAIN', 'HOSTED_ZONE_ID', 'HOSTED_ZONE_NAME', 'FASTSPEC_EXTERNAL_DNS']) {
      delete process.env[name];
    }
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  test('reads CDK context first', () => {
    process.env.FASTSPEC_DOMAIN = 'from-env.example.com';
    const app = new cdk.App({ context: { domain: 'from-context.example.com' } });
    expect(resolveDeploymentSettings(app).domain).toBe('from-context.example.com');
  });

  test('falls back to environment variables', () => {
    process.env.FASTSPEC_DOMAIN = 'from-env.example.com';
    process.env.HOSTED_ZONE_ID = 'ZENV';
    const settings = resolveDeploymentSettings(new cdk.App());
    expect(settings).toEqual({
      domain: 'from-env.example.com',
      hostedZoneId: 'ZENV',
      hostedZoneName: undefined,
      externalDns: false,
    });
  });

  test.each([
    [{ FASTSPEC_EXTERNAL_DNS: 'true' }, {}, true],
    [{ FASTSPEC_EXTERNAL_DNS: '1' }, {}, true],
    [{ FASTSPEC_EXTERNAL_DNS: 'false' }, {}, false],
    [{}, { externalDns: 'true' }, true],
    [{}, {}, false],
  ])('external DNS from env %j / context %j → %s', (env, context, expected) => {
    Object.assign(process.env, env);
    const app = new cdk.App({ context });
    expect(resolveDeploymentSettings(app).externalDns).toBe(expected);
  });
});

describe('hostedZoneFor', () => {
  test('references a known zone by ID without a lookup', () => {
    const stack = new cdk.Stack(new cdk.App(), 'S');
    const zone = hostedZoneFor(stack, getConfig('prod', { domain: 'specs.example.com', hostedZoneId: 'Z123' }));
    expect(zone.hostedZoneId).toBe('Z123');
    expect(zone.zoneName).toBe('specs.example.com');
  });

  test('supports a parent (apex) zone', () => {
    const stack = new cdk.Stack(new cdk.App(), 'S');
    const zone = hostedZoneFor(
      stack,
      getConfig('prod', { domain: 'specs.example.com', hostedZoneId: 'Z123', hostedZoneName: 'example.com' }),
    );
    expect(zone.zoneName).toBe('example.com');
  });
});
