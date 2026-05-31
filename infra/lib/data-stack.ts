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

function sizingFor(config: EnvConfig): DataSizing {
  if (config.env === 'prod') {
    return {
      rdsInstanceClass: ec2.InstanceClass.R6G,
      rdsInstanceSize: ec2.InstanceSize.LARGE,
      rdsMultiAz: true,
      cacheNodeType: 'cache.r6g.large',
    };
  }
  // local / dev / staging — burstable minimal
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

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { config } = props;
    const sizing = sizingFor(config);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: config.env === 'prod' ? 3 : 2,
      natGateways: config.env === 'prod' ? 1 : 0,
    });

    this.vpc = vpc;

    const vpcSubnets: ec2.SubnetSelection =
      config.env === 'prod'
        ? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
        : { subnetType: ec2.SubnetType.PRIVATE_ISOLATED };

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

    // ── ElastiCache Redis ─────────────────────────────────────────────────────
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: `${config.env} Redis subnet group`,
      subnetIds:
        config.env === 'prod'
          ? vpc.privateSubnets.map((s) => s.subnetId)
          : vpc.isolatedSubnets.map((s) => s.subnetId),
    });

    const redisCluster = new elasticache.CfnReplicationGroup(this, 'Redis', {
      replicationGroupDescription: `${config.env} Redis`,
      cacheNodeType: sizing.cacheNodeType,
      engine: 'redis',
      numCacheClusters: 1,
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
  }
}
