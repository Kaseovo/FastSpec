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

  test('provisions an ElastiCache Redis replication group', () => {
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      Engine: 'redis',
    });
  });

  test('exports a DbEndpoint CloudFormation output', () => {
    template.hasOutput('DbEndpoint', {});
  });

  test('exports a RedisEndpoint CloudFormation output', () => {
    template.hasOutput('RedisEndpoint', {});
  });

  test('exports a VpcId CloudFormation output', () => {
    template.hasOutput('VpcId', {});
  });

  test('uses a burstable instance class for RDS', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DBInstanceClass: 'db.t3.micro',
    });
  });

  test('uses a single-node ElastiCache cluster (no multi-AZ)', () => {
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      NumCacheClusters: 1,
    });
  });

  test('enables encryption at rest and in transit for Redis', () => {
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      AtRestEncryptionEnabled: true,
      TransitEncryptionEnabled: true,
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

  test('uses a production instance class for RDS', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DBInstanceClass: 'db.r6g.large',
    });
  });

  test('enables multi-AZ for RDS', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      MultiAZ: true,
    });
  });

  test('uses a production ElastiCache node type', () => {
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      CacheNodeType: 'cache.r6g.large',
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

  test('ElastiCache replication group has encryption at rest enabled', () => {
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      AtRestEncryptionEnabled: true,
    });
  });

  test('ElastiCache replication group has encryption in transit enabled', () => {
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      TransitEncryptionEnabled: true,
    });
  });
});

describe('DataStack — dev', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildStack('dev'));
  });

  test('RDS does not have DeletionProtection enabled', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DeletionProtection: false,
    });
  });
});

describe('DataStack — staging', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildStack('staging'));
  });

  test('RDS does not have DeletionProtection enabled', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DeletionProtection: false,
    });
  });
});
