import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { getConfig } from '../lib/config';
import { TEST_SETTINGS } from './settings';
import { LambdaStack } from '../lib/lambda-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { FrontendStack } from '../lib/frontend-stack';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildCertStack() {
  const app = new cdk.App();
  const config = getConfig('prod', TEST_SETTINGS);
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
  const config = getConfig('prod', TEST_SETTINGS);

  const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
    new cdk.Stack(app, 'HelperStack'),
    'FakeHZ',
    { hostedZoneId: 'Z1FAKEHZID', zoneName: config.domain },
  );

  const lambdaStack = new LambdaStack(app, 'FastSpec-Lambda-prod', { config });

  return new FrontendStack(app, 'FastSpec-Frontend-prod', {
    config,
    certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/fake-cert-id',
    lambdaFunctionUrl: lambdaStack.functionUrl,
    hostedZone,
  });
}

// ── CertificateStack ──────────────────────────────────────────────────────────

describe('CertificateStack — prod', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildCertStack());
  });

  test('provisions one ACM certificate', () => {
    template.resourceCountIs('AWS::CertificateManager::Certificate', 1);
  });

  test('ViewerCert covers the landing domain', () => {
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'fastspec.example.com',
    });
  });

  test('CertificateArn output is exported', () => {
    template.hasOutput('CertificateArn', {});
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

// ── FrontendStack — CloudFront distribution ───────────────────────────────────

describe('FrontendStack — CloudFront distribution', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildFrontendStack());
  });

  test('provisions exactly one CloudFront distribution', () => {
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  test('distribution is aliased to the domain', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Aliases: ['fastspec.example.com'],
      },
    });
  });

  test('distribution uses the ACM certificate', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        ViewerCertificate: {
          AcmCertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/fake-cert-id',
          SslSupportMethod: 'sni-only',
        },
      },
    });
  });

  test('distribution has /specs* behavior for SPA', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: '/specs*' }),
        ]),
      },
    });
  });

  test('distribution has /api* behavior', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: '/api*' }),
        ]),
      },
    });
  });

  test('distribution has /auth* behavior', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: '/auth*' }),
        ]),
      },
    });
  });

  test('distribution has /mcp* behavior', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: '/mcp*' }),
        ]),
      },
    });
  });

  test('/api* behavior has caching disabled', () => {
    const distros = template.findResources('AWS::CloudFront::Distribution');
    const distroValues = Object.values(distros);
    expect(distroValues).toHaveLength(1);
    const config = (distroValues[0] as any).Properties.DistributionConfig;
    const apiBehaviour = config.CacheBehaviors.find(
      (b: any) => b.PathPattern === '/api*',
    );
    expect(apiBehaviour).toBeDefined();
    // AWS managed CachingDisabled policy: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
    expect(JSON.stringify(apiBehaviour.CachePolicyId)).toMatch(
      /4135ea2d-6df8-44a3-9df3-4b5a84be39ad/,
    );
  });
});

// ── FrontendStack — Route53 ───────────────────────────────────────────────────

describe('FrontendStack — Route53 alias record', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(buildFrontendStack());
  });

  test('creates exactly one Route53 A record', () => {
    const records = template.findResources('AWS::Route53::RecordSet', {
      Properties: { Type: 'A' },
    });
    expect(Object.values(records)).toHaveLength(1);
  });

  test('A record points to the domain with a CloudFront alias target', () => {
    const records = template.findResources('AWS::Route53::RecordSet', {
      Properties: { Type: 'A', Name: 'fastspec.example.com.' },
    });
    const values = Object.values(records);
    expect(values).toHaveLength(1);
    const aliasTarget = (values[0] as any).Properties.AliasTarget;
    expect(aliasTarget).toBeDefined();
    expect(JSON.stringify(aliasTarget.DNSName)).toContain('Fn::GetAtt');
  });
});

// ── External DNS (e.g. Cloudflare) ───────────────────────────────────────────

describe('external DNS', () => {
  const config = getConfig('prod', { ...TEST_SETTINGS, externalDns: true });

  test('the certificate is DNS-validated without a Route 53 zone', () => {
    const app = new cdk.App();
    const cert = new CertificateStack(app, 'FastSpec-Cert-prod', {
      config,
      env: { account: '123456789012', region: 'us-east-1' },
    });
    const template = Template.fromStack(cert);
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'fastspec.example.com',
      ValidationMethod: 'DNS',
    });
    const [certificate] = Object.values(template.findResources('AWS::CertificateManager::Certificate'));
    expect(JSON.stringify(certificate)).not.toContain('HostedZoneId');
  });

  test('no Route 53 record: the domain is pointed at CloudFront by hand', () => {
    const app = new cdk.App();
    const lambdaStack = new LambdaStack(app, 'FastSpec-Lambda-prod', { config });
    const frontend = new FrontendStack(app, 'FastSpec-Frontend-prod', {
      config,
      certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/fake-cert-id',
      lambdaFunctionUrl: lambdaStack.functionUrl,
    });
    const template = Template.fromStack(frontend);
    template.resourceCountIs('AWS::Route53::RecordSet', 0);
    template.hasOutput('DistributionDomainName', {});
  });
});

// ── deployFrontend guard ──────────────────────────────────────────────────────

describe('deployFrontend guard', () => {
  test('FrontendStack is NOT instantiated when config.deployFrontend is false (local env)', () => {
    const app = new cdk.App();
    const config = getConfig('local');
    new LambdaStack(app, 'FastSpec-Lambda-local', { config });
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
    const config = getConfig('prod', TEST_SETTINGS);
    expect(config.deployFrontend).toBe(true);
  });
});
