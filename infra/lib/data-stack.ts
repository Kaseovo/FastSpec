import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
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
 * DataStack - stateful infrastructure: RDS (PostgreSQL).
 * Exports connection endpoints consumed by LambdaStack and WakeStack.
 *
 * RDS is publicly accessible (the Lambda runs outside a VPC, with
 * `natGateways: 0` to keep the VPC free - see ADR-0001). Lambda's outbound
 * traffic uses AWS's shared, non-allowlistable IP ranges, so restricting the
 * security group to specific CIDRs is not possible without moving the
 * Lambda into the VPC behind a NAT Gateway (a paid resource this
 * cost-optimized architecture deliberately avoids). This is a known,
 * documented tradeoff - see docs/adr/0002-rds-public-access-tradeoff.md for
 * the full rationale and the mitigations applied here:
 *   - `rds.force_ssl=1` enforced via the parameter group below, so traffic
 *     is encrypted in transit even though the network path is public.
 *   - The master password is never hardcoded in CDK: `Credentials.fromGeneratedSecret`
 *     has CloudFormation generate a strong random password into Secrets
 *     Manager (see `dbInstance.secret` / the `DbSecretArn` output below).
 *   - Storage is encrypted at rest (`storageEncrypted: true`).
 *
 * `backend/database.py` now fails fast (mirroring the `JWT_SECRET_KEY`
 * pattern in backend/config.py) rather than falling back to a hardcoded
 * password - see docs/adr/0002-rds-public-access-tradeoff.md.
 *
 * Non-superuser application DB role: `backend/database.py` now connects at
 * runtime as `fastspec_app`, a least-privilege role created/granted by
 * `backend/alembic/versions/b6f1d8c4a9e2_add_fastspec_app_role.py` (CONNECT
 * + schema USAGE + CRUD only - no CREATEDB/CREATEROLE/superuser). Its
 * password lives in the `FastspecAppDbSecret` Secrets Manager secret below
 * (`AppDbSecretArn` output), generated the same way as the master password.
 * This has **not** been applied to the live RDS instance yet - a human must
 * run the migration and redeploy; see the ADR for the required order.
 */
export class DataStack extends cdk.Stack {
  /** RDS endpoint exported for LambdaStack. */
  public readonly dbEndpoint: string;
  /** RDS instance identifier exported for WakeStack. */
  public readonly rdsInstanceId: string;
  /** ARN of the generated-password secret for the `fastspec_app` role. */
  public readonly appDbSecretArn: string;
  /** Secrets Manager ARN of the generated master (`postgres`) credentials. */
  public readonly dbSecretArn: string;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { config } = props;
    const sizing = sizingFor(config);

    // Keep the original VPC definition unchanged - CDK cannot safely modify
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
      // into Secrets Manager at deploy time - there is no hardcoded
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

    // Lambda runs outside the VPC - allow inbound PostgreSQL from anywhere.
    // See the class-level doc comment / ADR-0002 for why this can't be
    // scoped tighter without a bigger architectural change (Lambda-in-VPC +
    // NAT Gateway, or RDS Proxy + IAM DB auth). `rds.force_ssl=1` above
    // ensures the traffic itself is at least encrypted in transit.
    dbInstance.connections.allowFrom(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from public internet (Lambda is VPC-less) - see ADR-0002',
    );

    // ── fastspec_app least-privilege role password ─────────────────────────────
    // Not `rds.Credentials.fromGeneratedSecret` - that helper only applies to
    // master-user credentials created alongside the DB instance itself. The
    // `fastspec_app` role is created later by an Alembic migration
    // (backend/alembic/versions/b6f1d8c4a9e2_add_fastspec_app_role.py), so a
    // plain `secretsmanager.Secret` with a generated password is the right
    // primitive here: CloudFormation still generates a strong random value
    // into Secrets Manager, with no literal password anywhere in CDK.
    const appDbSecret = new secretsmanager.Secret(this, 'FastspecAppDbSecret', {
      description:
        "Password for the least-privilege 'fastspec_app' Postgres role " +
        '(see docs/adr/0002-rds-public-access-tradeoff.md)',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // ── CloudFormation outputs ────────────────────────────────────────────────
    const dbEndpointAddress = dbInstance.dbInstanceEndpointAddress;
    const dbEndpointPort = dbInstance.dbInstanceEndpointPort;

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: `${dbEndpointAddress}:${dbEndpointPort}`,
      description: 'RDS PostgreSQL endpoint',
    });

    if (!dbInstance.secret) {
      throw new Error('DataStack: the RDS instance has no generated master secret');
    }

    // Both passwords are read by the backend Lambda straight from Secrets
    // Manager (LambdaStack grants it read access to exactly these two), so a
    // fresh deployment needs no manual copying of generated passwords.
    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: dbInstance.secret.secretArn,
      description: 'Secrets Manager ARN of the generated master (postgres) credentials',
    });

    new cdk.CfnOutput(this, 'AppDbSecretArn', {
      value: appDbSecret.secretArn,
      description: "Secrets Manager ARN of the generated 'fastspec_app' role password",
    });

    this.dbEndpoint = `${dbEndpointAddress}:${dbEndpointPort}`;
    this.rdsInstanceId = dbInstance.instanceIdentifier;
    this.appDbSecretArn = appDbSecret.secretArn;
    this.dbSecretArn = dbInstance.secret.secretArn;
  }
}
