import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { getConfig } from '../lib/config';
import { WakeStack } from '../lib/wake-stack';

function buildWakeStack() {
  const app = new cdk.App();
  const config = getConfig('prod');
  return new WakeStack(app, 'FastSpec-Wake-prod', {
    config,
    clusterName: 'my-cluster',
    serviceName: 'backend-svc',
    mcpServiceName: 'mcp-svc',
    rdsInstanceId: 'my-rds',
  });
}

describe('WakeStack', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildWakeStack());
  });

  test('Lambda environment includes MCP_SERVICE_NAME', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          MCP_SERVICE_NAME: 'mcp-svc',
        }),
      },
    });
  });

  test('Lambda environment includes SERVICE_NAME', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          SERVICE_NAME: 'backend-svc',
        }),
      },
    });
  });
});
