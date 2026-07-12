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
 * RDS is publicly accessible (the Lambda runs outside a VPC, with
 * `natGateways: 0` to keep the VPC free — see ADR-0001). Lambda's outbound
 * traffic uses AWS's shared, non-allowlistable IP ranges, so restricting the
 * security group to specific CIDRs is not possible without moving the
 * Lambda into the VPC behind a NAT Gateway (a paid resource this
 * cost-optimized architecture deliberately avoids). This is a known,
 * documented tradeoff — see docs/adr/0002-rds-public-access-tradeoff.md for
 * the full rationale and the mitigations applied here:
 *   - `rds.force_ssl=1` enforced via the parameter group below, so traffic
 *     is encrypted in transit even though the network path is public.
 *   - The master password is never hardcoded in CDK: `Credentials.fromGeneratedSecret`
 *     has CloudFormation generate a strong random password into Secrets
 *     Manager (see `dbInstance.secret` / the `DbSecretArn` output below).
 *   - Storage is encrypted at rest (`storageEncrypted: true`).
 *
 * TODO (backend, out of scope for this infra pass): `backend/database.py`
 * currently falls back to a hardcoded `DB_PASSWORD=fastspec` default when
 * the `DB_PASSWORD` env var (populated from the `${env}/fastspec/db-password`
 * SSM parameter) is unset. That fallback should be removed in favor of a
 * fail-fast check mirroring the `JWT_SECRET_KEY` pattern in
 * backend/config.py, and the SSM parameter should be seeded from
 * `dbInstance.secret`'s generated password (via the `DbSecretArn` output
 * below) rather than a manually-typed value, to eliminate the risk of the
 * two ever drifting apart.
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

    // Enforce SSL/TLS for every connection to this instance. `rds.force_ssl`
    // is a static (reboot-required) parameter, applied server-side via a
    // parameter group so it can't be bypassed by a misconfigured client.
    const parameterGroup = new rds.ParameterGroup(this, 'PostgresParams', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      parameters: {
        'rds.force_ssl': '1',
      },
    });

    // ── RDS PostgreSQL ────────────────────────────────────────────────────────
    const dbInstance = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      // Explicit (rather than relying on the implicit CDK default) so the
      // intent is unambiguous: CloudFormation generates a random password
      // into Secrets Manager at deploy time — there is no hardcoded
      // password anywhere in this stack.
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      parameterGroup,
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
    // See the class-level doc comment / ADR-0002 for why this can't be
    // scoped tighter without a bigger architectural change (Lambda-in-VPC +
    // NAT Gateway, or RDS Proxy + IAM DB auth). `rds.force_ssl=1` above
    // ensures the traffic itself is at least encrypted in transit.
    dbInstance.connections.allowFrom(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from public internet (Lambda is VPC-less) — see ADR-0002',
    );

    // ── CloudFormation outputs ────────────────────────────────────────────────
    const dbEndpointAddress = dbInstance.dbInstanceEndpointAddress;
    const dbEndpointPort = dbInstance.dbInstanceEndpointPort;

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: `${dbEndpointAddress}:${dbEndpointPort}`,
      description: 'RDS PostgreSQL endpoint',
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: dbInstance.secret?.secretArn ?? 'unavailable',
      description:
        'Secrets Manager ARN holding the generated master password — seed the ' +
        '${env}/fastspec/db-password SSM parameter from this value, not by hand.',
    });

    this.dbEndpoint = `${dbEndpointAddress}:${dbEndpointPort}`;
    this.rdsInstanceId = dbInstance.instanceIdentifier;
  }
}
