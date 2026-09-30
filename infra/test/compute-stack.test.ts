import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { LambdaStack } from '../lib/lambda-stack';
import { getConfig } from '../lib/config';
import { TEST_SETTINGS } from './settings';

function buildStack(env: 'local' | 'prod') {
  const app = new cdk.App();
  const config = getConfig(env, TEST_SETTINGS);
  return new LambdaStack(app, `FastSpec-Lambda-${env}`, { config });
}

function policyStatements(template: Template): any[] {
  return Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
    (policy: any) => policy.Properties.PolicyDocument.Statement,
  );
}

const actionsOf = (statement: any): string[] => [statement.Action].flat();

describe('LambdaStack — local', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildStack('local'));
  });

  test('provisions a DockerImageFunction', () => {
    template.resourceCountIs('AWS::Lambda::Function', 1);
  });

  test('function has 512 MB memory and 2-minute timeout', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 512,
      Timeout: 120,
    });
  });

  test('function has a Function URL with AuthType NONE', () => {
    template.hasResourceProperties('AWS::Lambda::Url', {
      AuthType: 'NONE',
    });
  });

  test('secrets, the database URL included, are SSM parameter names', () => {
    const [fn] = Object.values(template.findResources('AWS::Lambda::Function'));
    const vars = (fn as any).Properties.Environment.Variables;
    expect(vars).toMatchObject({
      SSM_DATABASE_URL: '/local/fastspec/database-url',
      SSM_JWT_SECRET_KEY: '/local/fastspec/secret-key',
      SSM_OIDC_CLIENT_ID: '/local/fastspec/google-client-id',
      SSM_OIDC_CLIENT_SECRET: '/local/fastspec/google-client-secret',
    });
    expect(vars).not.toHaveProperty('DATABASE_URL');
  });

  test("function reads this environment's parameters, and no other secrets", () => {
    const statements = policyStatements(template);
    const read = statements.filter((s) => actionsOf(s).includes('ssm:GetParameters'));
    expect(read).toHaveLength(1);
    expect(JSON.stringify(read[0].Resource)).toContain(':parameter/local/fastspec/*');

    const others = statements
      .flatMap(actionsOf)
      .filter((a) => /^(secretsmanager|rds):/.test(a) || a === 'ssm:PutParameter');
    expect(others).toEqual([]);
  });

  test('outputs LambdaFunctionUrl', () => {
    template.hasOutput('LambdaFunctionUrl', {});
  });

  test('outputs LambdaFunctionArn', () => {
    template.hasOutput('LambdaFunctionArn', {});
  });

  test('outputs LambdaFunctionName', () => {
    template.hasOutput('LambdaFunctionName', {});
  });

  test('no VPC attachment on the Lambda function', () => {
    const resources = template.findResources('AWS::Lambda::Function');
    const fns = Object.values(resources);
    for (const fn of fns) {
      expect((fn as any).Properties?.VpcConfig).toBeUndefined();
    }
  });
});

describe('LambdaStack — prod', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildStack('prod'));
  });

  test('provisions a DockerImageFunction', () => {
    template.resourceCountIs('AWS::Lambda::Function', 1);
  });

  test('function URL leaves CORS to the app (two Allow-Origin headers break browsers)', () => {
    const [url] = Object.values(template.findResources('AWS::Lambda::Url'));
    expect((url as any).Properties.Cors).toBeUndefined();
  });
});
