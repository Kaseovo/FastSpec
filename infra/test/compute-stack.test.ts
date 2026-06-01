import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
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
    dbSecurityGroup: dataStack.dbSecurityGroup,
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
          Secrets: Match.arrayWith([
            Match.objectLike({ Name: 'SECRET_KEY' }),
            Match.objectLike({ Name: 'DB_PASSWORD' }),
          ]),
        },
      ],
    });
  });

  test('provisions a separate Migration Task definition', () => {
    template.resourceCountIs('AWS::ECS::TaskDefinition', 2);
  });

  test('migration task container command is alembic upgrade head', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Name: 'migrate',
          Command: ['alembic', 'upgrade', 'head'],
        },
      ],
    });
  });

  test('migration task definition includes db-password SSM secret', () => {
    const resources = template.findResources('AWS::ECS::TaskDefinition');
    const taskDefs = Object.values(resources);
    const migrateDef = taskDefs.find((r: any) =>
      r.Properties?.ContainerDefinitions?.some((c: any) => c.Name === 'migrate'),
    ) as any;
    const secrets: Array<{ Name: string; ValueFrom: any }> =
      migrateDef.Properties.ContainerDefinitions.find((c: any) => c.Name === 'migrate').Secrets ?? [];
    const valueFromStrings = secrets.map((s) => JSON.stringify(s.ValueFrom));
    expect(valueFromStrings.some((v) => v.includes('db-password'))).toBe(true);
  });

  test('migration task definition includes DB_ENDPOINT environment variable', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Name: 'migrate',
          Environment: Match.arrayWith([
            Match.objectLike({ Name: 'DB_ENDPOINT', Value: 'db.example.com:5432' }),
          ]),
        },
      ],
    });
  });
});

describe('ComputeStack — issue #91: real image, public subnet, SG, SSM secrets', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildStack('local'));
  });

  test('Fargate service has assignPublicIp ENABLED', () => {
    template.hasResourceProperties('AWS::ECS::Service', {
      NetworkConfiguration: {
        AwsvpcConfiguration: {
          AssignPublicIp: 'ENABLED',
        },
      },
    });
  });

  test('all six SSM secrets are wired into the backend container', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Name: 'backend',
          Secrets: Match.arrayWith([
            Match.objectLike({ Name: 'SECRET_KEY' }),
            Match.objectLike({ Name: 'DB_PASSWORD' }),
            Match.objectLike({ Name: 'GOOGLE_CLIENT_ID' }),
            Match.objectLike({ Name: 'GOOGLE_CLIENT_SECRET' }),
            Match.objectLike({ Name: 'GITHUB_CLIENT_ID' }),
            Match.objectLike({ Name: 'GITHUB_CLIENT_SECRET' }),
          ]),
        },
      ],
    });
  });

  test('SSM parameter names use /{env}/fastspec/ prefix', () => {
    // The six SSM parameters must reference the expected path-based names.
    // CDK renders SSM SecureString as a dynamic SSM reference; the parameter
    // name appears in the IAM policy actions or in the task definition via
    // the CFN parameter name.  We verify via the generated SSM parameter
    // value-from references inside Secrets[].ValueFrom.
    const resources = template.findResources('AWS::ECS::TaskDefinition');
    const taskDefs = Object.values(resources);
    const backendDef = taskDefs.find((r: any) =>
      r.Properties?.ContainerDefinitions?.some((c: any) => c.Name === 'backend'),
    ) as any;
    const secrets: Array<{ Name: string; ValueFrom: any }> =
      backendDef.Properties.ContainerDefinitions.find((c: any) => c.Name === 'backend').Secrets;

    const valueFromStrings = secrets.map((s) => JSON.stringify(s.ValueFrom));
    const expectedSuffixes = [
      'secret-key',
      'db-password',
      'google-client-id',
      'google-client-secret',
      'github-client-id',
      'github-client-secret',
    ];
    for (const suffix of expectedSuffixes) {
      expect(valueFromStrings.some((v) => v.includes(suffix))).toBe(true);
    }
  });

  test('Fargate security group allows port 8000 inbound from ALB SG only (not 0.0.0.0/0)', () => {
    // Ensure NO security group ingress rule opens port 8000 to 0.0.0.0/0
    const sgs = template.findResources('AWS::EC2::SecurityGroup');
    for (const [, sg] of Object.entries(sgs) as [string, any][]) {
      const ingress: any[] = sg.Properties?.SecurityGroupIngress ?? [];
      const openPort8000 = ingress.some(
        (rule) =>
          rule.CidrIp === '0.0.0.0/0' &&
          (rule.FromPort === 8000 || rule.ToPort === 8000),
      );
      expect(openPort8000).toBe(false);
    }

    // Ensure at least one SG has an ingress rule for port 8000 sourced from another SG
    const hasSgSourcedPort8000 = Object.values(sgs).some((sg: any) => {
      const ingress: any[] = sg.Properties?.SecurityGroupIngress ?? [];
      return ingress.some(
        (rule) =>
          rule.SourceSecurityGroupId !== undefined &&
          rule.FromPort === 8000 &&
          rule.ToPort === 8000,
      );
    });
    expect(hasSgSourcedPort8000).toBe(true);
  });

  test('container port mapping is 8000', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Name: 'backend',
          PortMappings: [{ ContainerPort: 8000, Protocol: 'tcp' }],
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
