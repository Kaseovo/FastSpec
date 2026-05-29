import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface ComputeStackProps extends cdk.StackProps {
  config: EnvConfig;
  dbEndpoint: string;
  redisEndpoint: string;
}

function isLocal(config: EnvConfig): boolean {
  return config.env === 'local';
}

/**
 * ComputeStack — ECS Fargate service (backend), ALB, and SSM secret references.
 * Imports connection endpoints from DataStack.
 *
 * For the `local` environment ALB listener rules cover /api and /auth only.
 * For dev/staging/prod they also cover frontend and landing-page routes.
 */
export class ComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { config } = props;

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
    });

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    // ── Backend Task Definition ───────────────────────────────────────────────
    const taskDef = new ecs.FargateTaskDefinition(this, 'BackendTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    taskDef.addContainer('backend', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      environment: {
        DB_ENDPOINT: props.dbEndpoint,
        REDIS_ENDPOINT: props.redisEndpoint,
        ENV: config.env,
      },
      secrets: {
        SECRET_KEY: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, 'SecretKey', {
            parameterName: `/${config.env}/fastspec/secret-key`,
          }),
        ),
        DB_PASSWORD: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, 'DbPassword', {
            parameterName: `/${config.env}/fastspec/db-password`,
          }),
        ),
      },
      portMappings: [{ containerPort: 8000 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'backend',
        logGroup: new logs.LogGroup(this, 'BackendLogGroup', {
          logGroupName: '/ecs/fastspec-backend',
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }),
    });

    // ── ECS Fargate Service ───────────────────────────────────────────────────
    const service = new ecs.FargateService(this, 'BackendService', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
    });

    // ── Application Load Balancer ─────────────────────────────────────────────
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
    });

    const listener = alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Not found',
      }),
    });

    const backendTargetGroup = listener.addTargets('BackendTargetGroup', {
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: { path: '/api/health' },
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api*'])],
    });

    listener.addTargets('AuthTargetGroup', {
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: { path: '/api/health' },
      priority: 20,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/auth*'])],
    });

    if (!isLocal(config)) {
      // Placeholder listener rules for frontend and landing-page (S3/CloudFront phase)
      listener.addTargets('FrontendPlaceholder', {
        port: 8000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [service],
        priority: 30,
        conditions: [elbv2.ListenerCondition.pathPatterns(['/*'])],
      });
    }

    void backendTargetGroup; // suppress unused warning

    // ── Migration Task Stub ───────────────────────────────────────────────────
    const migrateDef = new ecs.FargateTaskDefinition(this, 'MigrateTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    migrateDef.addContainer('migrate', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      command: ['echo', 'migration stub — Alembic not yet bootstrapped'],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'migrate' }),
    });

    // ── Stack Outputs (used by scripts/run-migrate.sh) ────────────────────────
    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      exportName: `${this.stackName}-ClusterName`,
    });

    new cdk.CfnOutput(this, 'MigrateTaskDefArn', {
      value: migrateDef.taskDefinitionArn,
      exportName: `${this.stackName}-MigrateTaskDefArn`,
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      exportName: `${this.stackName}-VpcId`,
    });
  }
}
