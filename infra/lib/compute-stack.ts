import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface ComputeStackProps extends cdk.StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  dbEndpoint: string;
}

function isLocal(config: EnvConfig): boolean {
  return config.env === 'local';
}

/**
 * ComputeStack — ECS Fargate service (backend), ALB, and SSM secret references.
 * Imports connection endpoints from DataStack.
 *
 * For the `local` environment ALB listener rules cover /api and /auth only.
 * For prod they also cover frontend and landing-page routes.
 */
export class ComputeStack extends cdk.Stack {
  /** The Application Load Balancer — used by FrontendStack for ALB origins. */
  readonly alb: elbv2.ApplicationLoadBalancer;
  /** ECS service name — used by WakeStack. */
  readonly serviceName: string;
  /** MCP ECS service name — used by WakeStack. */
  readonly mcpServiceName: string;
  /** ECS cluster — used by WakeStack. */
  readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { config } = props;
    const vpc = props.vpc;

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    // ── Application Load Balancer ─────────────────────────────────────────────
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
      description: 'ALB security group',
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP from internet');

    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
    });

    // ── Fargate Security Group ────────────────────────────────────────────────
    const fargateSg = new ec2.SecurityGroup(this, 'FargateSg', {
      vpc,
      description: 'Fargate backend service security group',
      allowAllOutbound: true,
    });
    fargateSg.addIngressRule(
      ec2.Peer.securityGroupId(albSg.securityGroupId),
      ec2.Port.tcp(8000),
      'Allow port 8000 from ALB SG only',
    );

    // ── Backend Task Definition ───────────────────────────────────────────────
    const taskDef = new ecs.FargateTaskDefinition(this, 'BackendTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    const env = config.env;

    taskDef.addContainer('backend', {
      image: ecs.ContainerImage.fromAsset('../', {
        file: 'backend/Dockerfile',
        platform: ecr_assets.Platform.LINUX_AMD64,
        exclude: ['infra/cdk.out', 'infra/node_modules', '.git', 'frontend/node_modules'],
      }),
      environment: {
        DB_ENDPOINT: props.dbEndpoint,
        ENV: env,
        FRONTEND_URL: `https://${config.domain}`,
        CORS_ORIGINS: `https://${config.domain}`,
      },
      secrets: {
        JWT_SECRET_KEY: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, 'SecretKey', {
            parameterName: `/${env}/fastspec/secret-key`,
          }),
        ),
        DB_PASSWORD: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, 'DbPassword', {
            parameterName: `/${env}/fastspec/db-password`,
          }),
        ),
        GOOGLE_CLIENT_ID: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, 'GoogleClientId', {
            parameterName: `/${env}/fastspec/google-client-id`,
          }),
        ),
        GOOGLE_CLIENT_SECRET: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, 'GoogleClientSecret', {
            parameterName: `/${env}/fastspec/google-client-secret`,
          }),
        ),
        GITHUB_CLIENT_ID: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, 'GithubClientId', {
            parameterName: `/${env}/fastspec/github-client-id`,
          }),
        ),
        GITHUB_CLIENT_SECRET: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, 'GithubClientSecret', {
            parameterName: `/${env}/fastspec/github-client-secret`,
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
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      assignPublicIp: true,
      securityGroups: [fargateSg],
    });
    this.alb = alb;
    this.serviceName = service.serviceName;
    this.cluster = cluster;

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

    // ── MCP Security Group ────────────────────────────────────────────────────
    const mcpSg = new ec2.SecurityGroup(this, 'McpSg', {
      vpc,
      description: 'Fargate MCP service security group',
      allowAllOutbound: true,
    });
    mcpSg.addIngressRule(
      ec2.Peer.securityGroupId(albSg.securityGroupId),
      ec2.Port.tcp(9000),
      'Allow port 9000 from ALB SG only',
    );

    // ── MCP Task Definition ───────────────────────────────────────────────────
    const mcpTaskDef = new ecs.FargateTaskDefinition(this, 'McpTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    mcpTaskDef.addContainer('mcp', {
      image: ecs.ContainerImage.fromAsset('../', {
        file: 'backend/Dockerfile-MCP',
        platform: ecr_assets.Platform.LINUX_AMD64,
        exclude: ['infra/cdk.out', 'infra/node_modules', '.git', 'frontend/node_modules'],
      }),
      environment: {
        DB_ENDPOINT: props.dbEndpoint,
        ENV: env,
      },
      secrets: {
        JWT_SECRET_KEY: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, 'McpSecretKey', {
            parameterName: `/${env}/fastspec/secret-key`,
          }),
        ),
        DB_PASSWORD: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, 'McpDbPassword', {
            parameterName: `/${env}/fastspec/db-password`,
          }),
        ),
      },
      portMappings: [{ containerPort: 9000 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'mcp',
        logGroup: new logs.LogGroup(this, 'McpLogGroup', {
          logGroupName: '/ecs/fastspec-mcp',
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }),
    });

    // ── MCP Fargate Service ───────────────────────────────────────────────────
    const mcpService = new ecs.FargateService(this, 'McpService', {
      cluster,
      taskDefinition: mcpTaskDef,
      desiredCount: 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      assignPublicIp: true,
      securityGroups: [mcpSg],
    });
    this.mcpServiceName = mcpService.serviceName;

    listener.addTargets('McpTargetGroup', {
      port: 9000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [mcpService],
      healthCheck: { path: '/api/health' },
      priority: 15,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/mcp*'])],
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
        healthCheck: { path: '/api/health' },
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
      image: ecs.ContainerImage.fromAsset('../', {
        file: 'backend/Dockerfile',
        platform: ecr_assets.Platform.LINUX_AMD64,
        exclude: ['infra/cdk.out', 'infra/node_modules', '.git', 'frontend/node_modules'],
      }),
      command: ['python', 'migrate.py'],
      environment: {
        DB_ENDPOINT: props.dbEndpoint,
      },
      secrets: {
        DB_PASSWORD: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, 'MigrateDbPassword', {
            parameterName: `/${env}/fastspec/db-password`,
          }),
        ),
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'migrate' }),
    });

    // ── Stack Outputs (used by scripts/run-migrate.sh) ────────────────────────
    new cdk.CfnOutput(this, 'AlbArn', {
      value: alb.loadBalancerArn,
      exportName: `${this.stackName}-AlbArn`,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      exportName: `${this.stackName}-ClusterName`,
    });

    new cdk.CfnOutput(this, 'MigrateTaskDefArn', {
      value: migrateDef.taskDefinitionArn,
      exportName: `${this.stackName}-MigrateTaskDefArn`,
    });

    new cdk.CfnOutput(this, 'FargateSgId', {
      value: fargateSg.securityGroupId,
      exportName: `${this.stackName}-FargateSgId`,
    });

    new cdk.CfnOutput(this, 'PublicSubnetId', {
      value: vpc.publicSubnets[0].subnetId,
      exportName: `${this.stackName}-PublicSubnetId`,
    });

    new cdk.CfnOutput(this, 'McpServiceName', {
      value: mcpService.serviceName,
      exportName: `${this.stackName}-McpServiceName`,
    });
  }
}
