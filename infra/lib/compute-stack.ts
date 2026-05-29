import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface ComputeStackProps extends cdk.StackProps {
  config: EnvConfig;
  dbEndpoint: string;
  redisEndpoint: string;
}

/**
 * ComputeStack — ECS Fargate service (backend), ALB, and SSM secret references.
 * Imports connection endpoints from DataStack.
 *
 * For the `local` environment ALB listener rules cover /api and /auth only.
 * For dev/staging/prod they also cover frontend and landing-page routes.
 *
 * TODO: implement ECS task definition, ALB constructs, and MigrationTask stub.
 */
export class ComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // Stubs — replaced once ECS and ALB constructs are added.
  }
}
