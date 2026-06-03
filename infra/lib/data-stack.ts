import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface DataStackProps extends cdk.StackProps {
  config: EnvConfig;
}

interface DataSizing {
  rdsInstanceClass: ec2.InstanceClass;
  rdsInstanceSize: ec2.InstanceSize;
  rdsMultiAz: boolean;
  cacheNodeType: string;
}

function sizingFor(_config: EnvConfig): DataSizing {
  return {
    rdsInstanceClass: ec2.InstanceClass.T3,
    rdsInstanceSize: ec2.InstanceSize.MICRO,
    rdsMultiAz: false,
    cacheNodeType: 'cache.t3.micro',
  };
}

/**
 * DataStack — stateful infrastructure: RDS (PostgreSQL) and ElastiCache (Redis).
 * Exports connection endpoints consumed by ComputeStack.
 */
export class DataStack extends cdk.Stack {
  /** Shared VPC exported for ComputeStack. */
  public readonly vpc: ec2.Vpc;
  /** RDS endpoint exported for ComputeStack. */
  public readonly dbEndpoint: string;
  /** ElastiCache endpoint exported for ComputeStack. */
  public readonly redisEndpoint: string;
  /** RDS instance identifier exported for WakeStack. */
  public readonly rdsInstanceId: string;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { config } = props;
    const sizing = sizingFor(config);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
    });
    this.vpc = vpc;

    const vpcSubnets: ec2.SubnetSelection = { subnetType: ec2.SubnetType.PRIVATE_ISOLATED };

    // ── RDS PostgreSQL ────────────────────────────────────────────────────────
    const dbInstance = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        sizing.rdsInstanceClass,
        sizing.rdsInstanceSize,
      ),
      vpc,
      vpcSubnets,
      multiAz: sizing.rdsMultiAz,
      storageEncrypted: true,
      publiclyAccessible: false,
      deletionProtection: config.env === 'prod',
      removalPolicy:
        config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.SNAPSHOT,
    });

    // Allow any resource within the VPC (Fargate service + migration task) to
    // reach RDS on port 5432. Using VPC CIDR avoids a cross-stack SG reference
    // that would create a dependency cycle with ComputeStack.
    dbInstance.connections.allowFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from within the VPC',
    );

    // ── ElastiCache Redis ─────────────────────────────────────────────────────
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: `${config.env} Redis subnet group`,
      subnetIds: vpc.isolatedSubnets.map((s) => s.subnetId),
    });

    const redisCluster = new elasticache.CfnReplicationGroup(this, 'Redis', {
      replicationGroupDescription: `${config.env} Redis`,
      cacheNodeType: sizing.cacheNodeType,
      engine: 'redis',
      numCacheClusters: 1,
      automaticFailoverEnabled: false,
      cacheSubnetGroupName: cacheSubnetGroup.ref,
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
    });

    // ── CloudFormation outputs ────────────────────────────────────────────────
    const dbEndpointAddress = dbInstance.dbInstanceEndpointAddress;
    const dbEndpointPort = dbInstance.dbInstanceEndpointPort;

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: `${dbEndpointAddress}:${dbEndpointPort}`,
      description: 'RDS PostgreSQL endpoint',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: `${redisCluster.attrPrimaryEndPointAddress}:${redisCluster.attrPrimaryEndPointPort}`,
      description: 'ElastiCache Redis endpoint',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'Shared VPC ID',
    });

    this.dbEndpoint = `${dbEndpointAddress}:${dbEndpointPort}`;
    this.redisEndpoint = `${redisCluster.attrPrimaryEndPointAddress}:${redisCluster.attrPrimaryEndPointPort}`;
    this.rdsInstanceId = dbInstance.instanceIdentifier;
  }
}
