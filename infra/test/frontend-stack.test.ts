import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { getConfig } from '../lib/config';
import { DataStack } from '../lib/data-stack';
import { ComputeStack } from '../lib/compute-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { FrontendStack } from '../lib/frontend-stack';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildCertStack() {
  const app = new cdk.App();
  const config = getConfig('prod');
  return new CertificateStack(app, 'FastSpec-Cert-prod', {
    config,
    env: { account: '123456789012', region: 'us-east-1' },
  });
}

/**
 * Build FrontendStack for prod using an injected (fake) certificate ARN and
 * hosted zone so we avoid cross-region SSM machinery and Route53 context
 * lookups in unit tests.
 */
function buildFrontendStack() {
  const app = new cdk.App();
  const config = getConfig('prod');

  const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
    new cdk.Stack(app, 'HelperStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    }),
    'FakeHZ',
    { hostedZoneId: 'Z1FAKEHZID', zoneName: config.domain },
  );

  const dataStack = new DataStack(app, 'FastSpec-Data-prod', { config });
  const computeStack = new ComputeStack(app, 'FastSpec-Compute-prod', {
    config,
    vpc: dataStack.vpc,
    dbEndpoint: 'db.example.com:5432',
    redisEndpoint: 'redis.example.com:6379',
  });

  const frontendStack = new FrontendStack(app, 'FastSpec-Frontend-prod', {
    config,
    certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/fake-cert-id',
    albDnsName: computeStack.alb.loadBalancerDnsName,
    hostedZone,
  });

  return frontendStack;
}

// ── CertificateStack ──────────────────────────────────────────────────────────

describe('CertificateStack — prod', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildCertStack());
  });

  test('provisions an ACM certificate in us-east-1', () => {
    template.resourceCountIs('AWS::CertificateManager::Certificate', 1);
  });

  test('certificate domain name matches prod domain', () => {
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'fastspec.kaseovo.com',
    });
  });

  test('certificate stack region is us-east-1', () => {
    const stack = buildCertStack();
    expect(stack.region).toBe('us-east-1');
  });
});

// ── FrontendStack — S3 buckets ────────────────────────────────────────────────

describe('FrontendStack — S3 buckets', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildFrontendStack());
  });

  test('provisions exactly two S3 buckets', () => {
    template.resourceCountIs('AWS::S3::Bucket', 2);
  });

  test('both buckets have all four PublicAccessBlock properties set to true', () => {
    // Assert both buckets block all public access
    const buckets = template.findResources('AWS::S3::Bucket');
    const bucketValues = Object.values(buckets);
    expect(bucketValues).toHaveLength(2);
    for (const bucket of bucketValues) {
      const cfg = (bucket as any).Properties.PublicAccessBlockConfiguration;
      expect(cfg).toMatchObject({
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      });
    }
  });
});

// ── FrontendStack — OAC ───────────────────────────────────────────────────────

describe('FrontendStack — Origin Access Control', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildFrontendStack());
  });

  test('creates at least one CloudFront OAC for S3', () => {
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  });

  test('OAC signing is SIGV4 always for S3', () => {
    template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
      OriginAccessControlConfig: {
        OriginAccessControlOriginType: 's3',
        SigningBehavior: 'always',
        SigningProtocol: 'sigv4',
      },
    });
  });

  test('bucket policies grant access to the CloudFront OAC', () => {
    // Both bucket policies should reference the OAC via cloudfront.amazonaws.com service
    const policies = template.findResources('AWS::S3::BucketPolicy');
    const policyValues = Object.values(policies);
    expect(policyValues.length).toBeGreaterThanOrEqual(2);

    for (const policy of policyValues) {
      const statements = (policy as any).Properties.PolicyDocument.Statement as any[];
      const hasOacStatement = statements.some(
        (s) => JSON.stringify(s).includes('cloudfront.amazonaws.com'),
      );
      expect(hasOacStatement).toBe(true);
    }
  });
});

// ── FrontendStack — CloudFront distribution ───────────────────────────────────

describe('FrontendStack — CloudFront distribution', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildFrontendStack());
  });

  test('provisions exactly one CloudFront distribution', () => {
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  test('distribution has a cache behaviour for /api*', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: '/api*' }),
        ]),
      },
    });
  });

  test('distribution has a cache behaviour for /auth*', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: '/auth*' }),
        ]),
      },
    });
  });

  test('distribution has a cache behaviour for /specs*', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: '/specs*' }),
        ]),
      },
    });
  });

  test('/api* behaviour has caching disabled', () => {
    const distros = template.findResources('AWS::CloudFront::Distribution');
    const distroValues = Object.values(distros);
    expect(distroValues).toHaveLength(1);
    const config = (distroValues[0] as any).Properties.DistributionConfig;
    const apiBehaviour = config.CacheBehaviors.find(
      (b: any) => b.PathPattern === '/api*',
    );
    expect(apiBehaviour).toBeDefined();
    // CachingDisabled policy ARN or TTL of 0
    const cachePolicyId = apiBehaviour.CachePolicyId;
    // AWS managed CachingDisabled policy: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
    expect(JSON.stringify(cachePolicyId)).toMatch(/4135ea2d-6df8-44a3-9df3-4b5a84be39ad/);
  });

  test('/auth* behaviour has caching disabled', () => {
    const distros = template.findResources('AWS::CloudFront::Distribution');
    const distroValues = Object.values(distros);
    const config = (distroValues[0] as any).Properties.DistributionConfig;
    const authBehaviour = config.CacheBehaviors.find(
      (b: any) => b.PathPattern === '/auth*',
    );
    expect(authBehaviour).toBeDefined();
    const cachePolicyId = authBehaviour.CachePolicyId;
    expect(JSON.stringify(cachePolicyId)).toMatch(/4135ea2d-6df8-44a3-9df3-4b5a84be39ad/);
  });

  test('distribution uses the ACM certificate', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        ViewerCertificate: {
          AcmCertificateArn:
            'arn:aws:acm:us-east-1:123456789012:certificate/fake-cert-id',
          SslSupportMethod: 'sni-only',
        },
      },
    });
  });

  test('distribution serves the prod domain', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Aliases: ['fastspec.kaseovo.com'],
      },
    });
  });
});

// ── FrontendStack — Route53 ───────────────────────────────────────────────────

describe('FrontendStack — Route53 alias record', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildFrontendStack());
  });

  test('creates a Route53 A record', () => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'A',
    });
  });

  test('Route53 A record has an alias target pointing to CloudFront', () => {
    // CloudFront's hosted zone ID comes from a Fn::FindInMap in the template,
    // so we verify the alias target's DNSName resolves to the distribution's
    // DomainName (a Fn::GetAtt reference).
    const records = template.findResources('AWS::Route53::RecordSet', {
      Properties: { Type: 'A' },
    });
    const values = Object.values(records);
    expect(values).toHaveLength(1);
    const aliasTarget = (values[0] as any).Properties.AliasTarget;
    expect(aliasTarget).toBeDefined();
    // DNS name must be a GetAtt to the CloudFront distribution
    expect(JSON.stringify(aliasTarget.DNSName)).toContain('Fn::GetAtt');
  });
});

// ── deployFrontend guard ──────────────────────────────────────────────────────

describe('deployFrontend guard', () => {
  test('FrontendStack is NOT instantiated when config.deployFrontend is false (local env)', () => {
    const app = new cdk.App();
    const config = getConfig('local');
    // Replicate what bin/fastspec.ts does — only create FrontendStack when deployFrontend===true
    const dataStack = new DataStack(app, 'FastSpec-Data-local', { config });
    new ComputeStack(app, 'FastSpec-Compute-local', {
      config,
      vpc: dataStack.vpc,
      dbEndpoint: 'db.example.com:5432',
      redisEndpoint: 'redis.example.com:6379',
    });
    if (config.deployFrontend) {
      // Should not reach here for local
      throw new Error('FrontendStack should not be instantiated for local env');
    }
    // If we reach here the guard works — verify no FrontendStack in the app
    const stacks = app.node.children.filter((c) => c instanceof cdk.Stack) as cdk.Stack[];
    const frontendStacks = stacks.filter((s) => s.stackName.includes('Frontend'));
    expect(frontendStacks).toHaveLength(0);
  });

  test('config.deployFrontend is false for the local environment', () => {
    const config = getConfig('local');
    expect(config.deployFrontend).toBe(false);
  });

  test('config.deployFrontend is true for the prod environment', () => {
    const config = getConfig('prod');
    expect(config.deployFrontend).toBe(true);
  });
});
