import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { LambdaStack } from '../lib/lambda-stack';
import { getConfig } from '../lib/config';

function buildStack(env: 'local' | 'prod') {
  const app = new cdk.App();
  const config = getConfig(env);
  return new LambdaStack(app, `FastSpec-Lambda-${env}`, {
    config,
    dbEndpoint: 'db.example.com:5432',
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
        AllowOrigins: Match.arrayWith(['https://fastspec.kaseovo.com']),
      }),
    });
  });
});
