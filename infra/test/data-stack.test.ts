import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DataStack } from '../lib/data-stack';
import { getConfig, Env } from '../lib/config';

function buildStack(env: Env) {
  const app = new cdk.App();
  const config = getConfig(env);
  return new DataStack(app, `FastSpec-Data-${env}`, { config });
}

describe('DataStack — local', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildStack('local'));
  });

  test('provisions an RDS PostgreSQL DBInstance', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
    });
  });

  test('exports a DbEndpoint CloudFormation output', () => {
    template.hasOutput('DbEndpoint', {});
  });

  test('exports a VpcId CloudFormation output', () => {
    template.hasOutput('VpcId', {});
  });

  test('uses a burstable instance class for RDS', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DBInstanceClass: 'db.t3.micro',
    });
  });

  test('enables storage encryption on RDS', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      StorageEncrypted: true,
    });
  });

  test('RDS instance is not publicly accessible', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      PubliclyAccessible: false,
    });
  });
});

describe('DataStack — prod', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildStack('prod'));
  });

  test('uses t3.micro instance class for RDS', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DBInstanceClass: 'db.t3.micro',
    });
  });

  test('does not enable multi-AZ for RDS', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      MultiAZ: false,
    });
  });

  test('RDS has DeletionProtection enabled', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DeletionProtection: true,
    });
  });

  test('RDS has DeletionPolicy: Retain', () => {
    template.hasResource('AWS::RDS::DBInstance', {
      DeletionPolicy: 'Retain',
    });
  });
});
