import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DataStack } from '../lib/data-stack';
import { ComputeStack } from '../lib/compute-stack';
import { getConfig } from '../lib/config';

function buildStack(env: 'local' | 'dev') {
  const app = new cdk.App();
  const config = getConfig(env);
  const dataStack = new DataStack(app, `FastSpec-Data-${env}`, { config });
  return new ComputeStack(app, `FastSpec-Compute-${env}`, {
    config,
    vpc: dataStack.vpc,
    dbEndpoint: 'db.example.com:5432',
    redisEndpoint: 'redis.example.com:6379',
  });
}

describe('ComputeStack — local', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildStack('local'));
  });

  test('provisions an ECS Cluster', () => {
    template.resourceCountIs('AWS::ECS::Cluster', 1);
  });

  test('provisions a Fargate TaskDefinition for the backend', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      RequiresCompatibilities: ['FARGATE'],
      NetworkMode: 'awsvpc',
    });
  });

  test('backend task definition has a single backend container', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Name: 'backend',
        },
      ],
    });
  });

  test('provisions an ECS Fargate Service', () => {
    template.hasResourceProperties('AWS::ECS::Service', {
      LaunchType: 'FARGATE',
    });
  });

  test('provisions an Application Load Balancer', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Type: 'application',
    });
  });

  test('ALB has an HTTP listener', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 80,
      Protocol: 'HTTP',
    });
  });

  test('ALB has a listener rule for /api*', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Conditions: [{ Field: 'path-pattern', PathPatternConfig: { Values: ['/api*'] } }],
    });
  });

  test('ALB has a listener rule for /auth*', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Conditions: [{ Field: 'path-pattern', PathPatternConfig: { Values: ['/auth*'] } }],
    });
  });

  test('backend container has SSM-backed secrets (not plaintext)', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Name: 'backend',
          Secrets: [
            { Name: 'SECRET_KEY' },
            { Name: 'DB_PASSWORD' },
          ],
        },
      ],
    });
  });

  test('provisions a separate Migration Task definition', () => {
    template.resourceCountIs('AWS::ECS::TaskDefinition', 2);
  });

  test('migration task runs a no-op stub command', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Name: 'migrate',
          Command: ['echo', 'migration stub — Alembic not yet bootstrapped'],
        },
      ],
    });
  });
});

describe('ComputeStack — isLocal() guard', () => {
  test('local template has exactly 2 backend listener rules (api + auth only)', () => {
    const localTemplate = Template.fromStack(buildStack('local'));
    localTemplate.resourceCountIs('AWS::ElasticLoadBalancingV2::ListenerRule', 2);
  });

  test('non-local template has more than 2 listener rules (frontend placeholder added)', () => {
    const devTemplate = Template.fromStack(buildStack('dev'));
    devTemplate.resourceCountIs('AWS::ElasticLoadBalancingV2::ListenerRule', 3);
  });
});
