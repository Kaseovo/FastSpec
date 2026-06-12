import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { getConfig } from '../lib/config';
import { WakeStack } from '../lib/wake-stack';

function buildWakeStack() {
  const app = new cdk.App();
  const config = getConfig('prod');
  return new WakeStack(app, 'FastSpec-Wake-prod', {
    config,
    lambdaFunctionName: 'fastspec-backend-fn',
    rdsInstanceId: 'my-rds',
  });
}

describe('WakeStack', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildWakeStack());
  });

  test('Lambda environment includes LAMBDA_FUNCTION_NAME', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          LAMBDA_FUNCTION_NAME: 'fastspec-backend-fn',
        }),
      },
    });
  });

  test('Lambda environment includes RDS_INSTANCE_ID', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          RDS_INSTANCE_ID: 'my-rds',
        }),
      },
    });
  });

  test('WakeFunctionUrl output is exported', () => {
    template.hasOutput('WakeFunctionUrl', {});
  });
});
