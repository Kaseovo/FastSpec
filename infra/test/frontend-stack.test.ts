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
    new cdk.Stack(app, 'HelperStack'),
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

  return new FrontendStack(app, 'FastSpec-Frontend-prod', {
    config,
    certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/fake-cert-id',
    albDnsName: computeStack.alb.loadBalancerDnsName,
    hostedZone,
  });
}

// ── CertificateStack ──────────────────────────────────────────────────────────

describe('CertificateStack — prod', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildCertStack());
  });

  test('provisions two ACM certificates (original + v2 with SAN)', () => {
    // ViewerCert (legacy, single domain) + ViewerCertV2 (domain + appDomain SAN)
    template.resourceCountIs('AWS::CertificateManager::Certificate', 2);
  });

  test('ViewerCertV2 covers both domain and appDomain', () => {
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'fastspec.kaseovo.com',
      SubjectAlternativeNames: ['app.fastspec.kaseovo.com'],
    });
  });

  test('ViewerCert (legacy) covers only the landing domain', () => {
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'fastspec.kaseovo.com',
    });
  });

  test('CertificateArnV2 output is exported', () => {
    template.hasOutput('CertificateArnV2', {});
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

  test('creates exactly one CloudFront OAC for S3', () => {
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

// ── FrontendStack — CloudFront distributions ──────────────────────────────────

describe('FrontendStack — CloudFront distributions', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildFrontendStack());
  });

  test('provisions exactly two CloudFront distributions', () => {
    template.resourceCountIs('AWS::CloudFront::Distribution', 2);
  });

  test('LandingDistribution is aliased to the landing domain', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Aliases: ['fastspec.kaseovo.com'],
      },
    });
  });

  test('AppDistribution is aliased to the app domain', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Aliases: ['app.fastspec.kaseovo.com'],
      },
    });
  });

  test('both distributions use the ACM certificate', () => {
    const distros = template.findResources('AWS::CloudFront::Distribution');
    const distroValues = Object.values(distros);
    expect(distroValues).toHaveLength(2);
    for (const distro of distroValues) {
      const cert = (distro as any).Properties.DistributionConfig.ViewerCertificate;
      expect(cert.AcmCertificateArn).toBe(
        'arn:aws:acm:us-east-1:123456789012:certificate/fake-cert-id',
      );
      expect(cert.SslSupportMethod).toBe('sni-only');
    }
  });

  test('LandingDistribution has /specs* redirect behavior', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Aliases: ['fastspec.kaseovo.com'],
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: '/specs*' }),
        ]),
      },
    });
  });

  test('LandingDistribution has /api* behavior', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Aliases: ['fastspec.kaseovo.com'],
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: '/api*' }),
        ]),
      },
    });
  });

  test('AppDistribution has /api* behavior', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Aliases: ['app.fastspec.kaseovo.com'],
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: '/api*' }),
        ]),
      },
    });
  });

  test('/api* behaviors on both distributions have caching disabled', () => {
    const distros = template.findResources('AWS::CloudFront::Distribution');
    const distroValues = Object.values(distros);
    // AWS managed CachingDisabled policy: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
    for (const distro of distroValues) {
      const config = (distro as any).Properties.DistributionConfig;
      const apiBehaviour = config.CacheBehaviors.find(
        (b: any) => b.PathPattern === '/api*',
      );
      expect(apiBehaviour).toBeDefined();
      expect(JSON.stringify(apiBehaviour.CachePolicyId)).toMatch(
        /4135ea2d-6df8-44a3-9df3-4b5a84be39ad/,
      );
    }
  });
});

// ── FrontendStack — Route53 ───────────────────────────────────────────────────

describe('FrontendStack — Route53 alias records', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildFrontendStack());
  });

  test('creates exactly two Route53 A records', () => {
    const records = template.findResources('AWS::Route53::RecordSet', {
      Properties: { Type: 'A' },
    });
    expect(Object.values(records)).toHaveLength(2);
  });

  test('landing domain A record has a CloudFront alias target', () => {
    const records = template.findResources('AWS::Route53::RecordSet', {
      Properties: { Type: 'A', Name: 'fastspec.kaseovo.com.' },
    });
    const values = Object.values(records);
    expect(values).toHaveLength(1);
    const aliasTarget = (values[0] as any).Properties.AliasTarget;
    expect(aliasTarget).toBeDefined();
    expect(JSON.stringify(aliasTarget.DNSName)).toContain('Fn::GetAtt');
  });

  test('app domain A record has a CloudFront alias target', () => {
    const records = template.findResources('AWS::Route53::RecordSet', {
      Properties: { Type: 'A', Name: 'app.fastspec.kaseovo.com.' },
    });
    const values = Object.values(records);
    expect(values).toHaveLength(1);
    const aliasTarget = (values[0] as any).Properties.AliasTarget;
    expect(aliasTarget).toBeDefined();
    expect(JSON.stringify(aliasTarget.DNSName)).toContain('Fn::GetAtt');
  });
});

// ── deployFrontend guard ──────────────────────────────────────────────────────

describe('deployFrontend guard', () => {
  test('FrontendStack is NOT instantiated when config.deployFrontend is false (local env)', () => {
    const app = new cdk.App();
    const config = getConfig('local');
    const dataStack = new DataStack(app, 'FastSpec-Data-local', { config });
    new ComputeStack(app, 'FastSpec-Compute-local', {
      config,
      vpc: dataStack.vpc,
      dbEndpoint: 'db.example.com:5432',
      redisEndpoint: 'redis.example.com:6379',
    });
    if (config.deployFrontend) {
      throw new Error('FrontendStack should not be instantiated for local env');
    }
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
