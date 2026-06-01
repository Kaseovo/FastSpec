import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DataStack } from '../lib/data-stack';
import { ComputeStack } from '../lib/compute-stack';
import { getConfig } from '../lib/config';

/**
 * Builds both stacks in the same CDK App to verify cross-stack VPC sharing.
 */
function buildBothStacks(env: 'local' | 'dev' | 'prod') {
  const app = new cdk.App();
  const config = getConfig(env);
  const dataStack = new DataStack(app, `FastSpec-Data-${env}`, { config });
  const computeStack = new ComputeStack(app, `FastSpec-Compute-${env}`, {
    config,
    vpc: dataStack.vpc,
    dbEndpoint: dataStack.dbEndpoint,
    redisEndpoint: dataStack.redisEndpoint,
    dbSecurityGroup: dataStack.dbSecurityGroup,
  });
  return { dataStack, computeStack };
}

describe('VPC ownership — DataStack owns the shared VPC', () => {
  test('DataStack exports a VpcId CloudFormation output', () => {
    const app = new cdk.App();
    const config = getConfig('local');
    const dataStack = new DataStack(app, 'FastSpec-Data-local', { config });
    const template = Template.fromStack(dataStack);
    template.hasOutput('VpcId', {});
  });

  test('exactly one VPC resource exists across DataStack and ComputeStack combined (local)', () => {
    const { dataStack, computeStack } = buildBothStacks('local');
    const dataTemplate = Template.fromStack(dataStack);
    const computeTemplate = Template.fromStack(computeStack);

    const dataVpcs = dataTemplate.findResources('AWS::EC2::VPC');
    const computeVpcs = computeTemplate.findResources('AWS::EC2::VPC');

    const totalVpcCount = Object.keys(dataVpcs).length + Object.keys(computeVpcs).length;
    expect(totalVpcCount).toBe(1);
  });

  test('exactly one VPC resource exists across DataStack and ComputeStack combined (prod)', () => {
    const { dataStack, computeStack } = buildBothStacks('prod');
    const dataTemplate = Template.fromStack(dataStack);
    const computeTemplate = Template.fromStack(computeStack);

    const dataVpcs = dataTemplate.findResources('AWS::EC2::VPC');
    const computeVpcs = computeTemplate.findResources('AWS::EC2::VPC');

    const totalVpcCount = Object.keys(dataVpcs).length + Object.keys(computeVpcs).length;
    expect(totalVpcCount).toBe(1);
  });

  test('ComputeStack ECS cluster uses the VPC from DataStack', () => {
    const { dataStack, computeStack } = buildBothStacks('local');
    // If ComputeStack creates no VPC itself, the VPC resource count in ComputeStack is 0
    const computeTemplate = Template.fromStack(computeStack);
    const computeVpcs = computeTemplate.findResources('AWS::EC2::VPC');
    expect(Object.keys(computeVpcs).length).toBe(0);
  });
});
