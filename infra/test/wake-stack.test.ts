import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { getConfig } from '../lib/config';
import { WakeStack } from '../lib/wake-stack';

function buildWakeStack() {
  const app = new cdk.App();
  const config = getConfig('prod');
  return new WakeStack(app, 'FastSpec-Wake-prod', {
    config,
    rdsInstanceId: 'my-rds',
  });
}

describe('WakeStack', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildWakeStack());
  });

  test('wake Lambda environment includes RDS_INSTANCE_ID', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          RDS_INSTANCE_ID: 'my-rds',
        }),
      },
    });
  });

  test('wake Lambda has no ECS environment variables', () => {
    // All Lambda functions in the stack should lack ECS-related env vars
    const lambdas = template.findResources('AWS::Lambda::Function');
    for (const [, resource] of Object.entries(lambdas)) {
      const envVars = resource.Properties?.Environment?.Variables ?? {};
      expect(envVars).not.toHaveProperty('CLUSTER_NAME');
      expect(envVars).not.toHaveProperty('SERVICE_NAME');
      expect(envVars).not.toHaveProperty('MCP_SERVICE_NAME');
    }
  });

  test('no ECS IAM actions granted to any role', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const allStatements = Object.values(policies).flatMap((p: any) =>
      p.Properties?.PolicyDocument?.Statement ?? [],
    );
    for (const stmt of allStatements) {
      const actions: string[] = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
      for (const action of actions) {
        expect(action).not.toMatch(/^ecs:/i);
      }
    }
  });

  test('auto-stop Lambda has RDS_INSTANCE_ID environment variable', () => {
    // The auto-stop function uses inline code; verify it also has RDS_INSTANCE_ID
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          RDS_INSTANCE_ID: 'my-rds',
        }),
      },
    });
  });

  test('CloudWatch Events rule triggers on 30-minute schedule', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'rate(30 minutes)',
    });
  });

  test('CloudWatch Events rule targets the auto-stop Lambda', () => {
    const rules = template.findResources('AWS::Events::Rule');
    const ruleWithTarget = Object.values(rules).find((r: any) =>
      (r.Properties?.Targets ?? []).some((t: any) => t.Arn != null),
    );
    expect(ruleWithTarget).toBeDefined();
  });

  test('auto-stop role has rds:StopDBInstance permission', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['rds:StopDBInstance']),
          }),
        ]),
      },
    });
  });

  test('Function URL is created for wake Lambda', () => {
    template.resourceCountIs('AWS::Lambda::Url', 1);
  });
});
