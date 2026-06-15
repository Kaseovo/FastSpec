import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface DataStackProps extends cdk.StackProps {
  config: EnvConfig;
}

interface DataSizing {
  rdsInstanceClass: ec2.InstanceClass;
  rdsInstanceSize: ec2.InstanceSize;
  rdsMultiAz: boolean;
}

function sizingFor(_config: EnvConfig): DataSizing {
  return {
    rdsInstanceClass: ec2.InstanceClass.T3,
    rdsInstanceSize: ec2.InstanceSize.MICRO,
    rdsMultiAz: false,
  };
}

/**
 * DataStack — stateful infrastructure: RDS (PostgreSQL).
 * Exports connection endpoints consumed by LambdaStack and WakeStack.
 *
 * RDS is publicly accessible (the Lambda runs outside a VPC). The VPC is an
 * internal implementation detail required by CDK; it is no longer shared with
 * other stacks.
 */
export class DataStack extends cdk.Stack {
  /** RDS endpoint exported for LambdaStack. */
  public readonly dbEndpoint: string;
  /** RDS instance identifier exported for WakeStack. */
  public readonly rdsInstanceId: string;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { config } = props;
    const sizing = sizingFor(config);

    // Keep the original VPC definition unchanged — CDK cannot safely modify
    // existing subnets in-place (CIDR conflicts). The VPC costs nothing
    // (natGateways: 0). RDS is moved to the PUBLIC subnets so Lambda (which
    // runs outside any VPC) can reach it over the internet.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
    });

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
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      multiAz: sizing.rdsMultiAz,
      storageEncrypted: true,
      publiclyAccessible: true,
      deletionProtection: config.env === 'prod',
      removalPolicy:
        config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.SNAPSHOT,
    });

    // Lambda runs outside the VPC — allow inbound PostgreSQL from anywhere.
    dbInstance.connections.allowFrom(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from public internet (Lambda is VPC-less)',
    );

    // ── CloudFormation outputs ────────────────────────────────────────────────
    const dbEndpointAddress = dbInstance.dbInstanceEndpointAddress;
    const dbEndpointPort = dbInstance.dbInstanceEndpointPort;

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: `${dbEndpointAddress}:${dbEndpointPort}`,
      description: 'RDS PostgreSQL endpoint',
    });

    this.dbEndpoint = `${dbEndpointAddress}:${dbEndpointPort}`;
    this.rdsInstanceId = dbInstance.instanceIdentifier;
  }
}
