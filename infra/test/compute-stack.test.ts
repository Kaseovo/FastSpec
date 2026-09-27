import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { LambdaStack } from '../lib/lambda-stack';
import { getConfig } from '../lib/config';
import { TEST_SETTINGS } from './settings';

function buildStack(env: 'local' | 'prod') {
  const app = new cdk.App();
  const config = getConfig(env, TEST_SETTINGS);
  return new LambdaStack(app, `FastSpec-Lambda-${env}`, {
    config,
    dbEndpoint: 'db.example.com:5432',
    dbSecretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:master-AbCdEf',
    appDbSecretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:app-AbCdEf',
  });
}

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

  test('function environment includes DB_ENDPOINT', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          DB_ENDPOINT: 'db.example.com:5432',
        }),
      },
    });
  });

  test('database passwords come from Secrets Manager, not SSM', () => {
    const [fn] = Object.values(template.findResources('AWS::Lambda::Function'));
    const vars = (fn as any).Properties.Environment.Variables;
    expect(vars.DB_SECRET_ARN).toMatch(/secret:master/);
    expect(vars.APP_DB_SECRET_ARN).toMatch(/secret:app/);
    expect(vars).not.toHaveProperty('SSM_DB_PASSWORD');
    expect(vars).not.toHaveProperty('SSM_FASTSPEC_APP_DB_PASSWORD');
  });

  test('function can read exactly the two database secrets', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'secretsmanager:GetSecretValue',
            Resource: [
              'arn:aws:secretsmanager:us-east-1:123456789012:secret:master-AbCdEf',
              'arn:aws:secretsmanager:us-east-1:123456789012:secret:app-AbCdEf',
            ],
          }),
        ]),
      },
    });
  });

  test('function environment includes SSM_WAKE_PARAM', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          SSM_WAKE_PARAM: Match.stringLikeRegexp('wake-last-triggered'),
        }),
      },
    });
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

  test('function URL CORS allows the prod domain', () => {
    template.hasResourceProperties('AWS::Lambda::Url', {
      Cors: Match.objectLike({
        AllowOrigins: Match.arrayWith(['https://fastspec.example.com']),
      }),
    });
  });
});
