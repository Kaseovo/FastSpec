import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface DataStackProps extends cdk.StackProps {
  config: EnvConfig;
}

/**
 * DataStack — stateful infrastructure: RDS (PostgreSQL) and ElastiCache (Redis).
 * Exports connection endpoints consumed by ComputeStack.
 *
 * TODO: implement RDS and ElastiCache constructs.
 */
export class DataStack extends cdk.Stack {
  /** RDS endpoint exported for ComputeStack. */
  public readonly dbEndpoint: string;
  /** ElastiCache endpoint exported for ComputeStack. */
  public readonly redisEndpoint: string;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // Stubs — replaced once Alembic and real data constructs are added.
    this.dbEndpoint = 'localhost:5432';
    this.redisEndpoint = 'localhost:6379';
  }
}
