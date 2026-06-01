import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface FrontendStackProps extends cdk.StackProps {
  config: EnvConfig;
  /**
   * ARN of the ACM certificate in us-east-1.
   * Injected directly into the CloudFormation Distribution resource via L1
   * property override — bypasses CDK's cross-region certificate region check
   * and avoids CrossRegionExportWriter entirely.
   */
  certificateArn: string;
  /** DNS name of the ALB in ComputeStack — used for /api* and /auth* origins. */
  albDnsName: string;
  /**
   * Route53 hosted zone for the environment domain.
   * Inject in tests via `HostedZone.fromHostedZoneAttributes`.
   * Omit in production — the stack will look it up via `HostedZone.fromLookup`.
   */
  hostedZone?: route53.IHostedZone;
}

/**
 * FrontendStack — S3 buckets, CloudFront distribution, and Route53 alias.
 *
 * Two private S3 buckets (SPA assets + landing-page assets) served through a
 * CloudFront distribution that also proxies `/api*` and `/auth*` to the ALB.
 * Only deployed when `config.deployFrontend === true`.
 */
export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ── S3 Buckets (private, no public access) ────────────────────────────────

    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const landingBucket = new s3.Bucket(this, 'LandingBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── Origin Access Control ─────────────────────────────────────────────────

    const oac = new cloudfront.S3OriginAccessControl(this, 'S3OAC', {
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    });

    // ── ALB origin (used for /api* and /auth*) ────────────────────────────────

    const albOrigin = new origins.HttpOrigin(props.albDnsName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    });

    // ── CloudFront Distribution ───────────────────────────────────────────────
    //
    // `certificate` and `domainNames` are intentionally omitted from the L2
    // props to avoid CDK's synth-time validation that rejects certificates not
    // scoped to a us-east-1 construct.  ViewerCertificate and Aliases are
    // patched in below at the L1 (CfnDistribution) level so the ARN is
    // embedded verbatim — no CrossRegionExportWriter involved.

    // Replicates nginx `try_files $uri $uri/ $uri/index.html =404`:
    // - /log-in   → /log-in/index.html
    // - /log-in/  → /log-in/index.html
    // - /assets/foo.svg → unchanged (has a file extension)
    const urlRewriteFn = new cloudfront.Function(this, 'UrlRewriteFn', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var uri = event.request.uri;
  if (!uri.includes('.')) {
    if (!uri.endsWith('/')) {
      uri = uri + '/';
    }
    event.request.uri = uri + 'index.html';
  }
  return event.request;
}
      `.trim()),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(landingBucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [{
          function: urlRewriteFn,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        '/specs*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket, {
            originAccessControl: oac,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        '/api*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        '/auth*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    // Patch ViewerCertificate and Aliases directly on the L1 resource.
    // Equivalent to `certificate` + `domainNames` + `minimumProtocolVersion`
    // on the L2, but skips CDK's us-east-1 region assertion for the cert object.
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyOverride('DistributionConfig.ViewerCertificate', {
      AcmCertificateArn: props.certificateArn,
      SslSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.2_2021',
    });
    cfnDistribution.addPropertyOverride('DistributionConfig.Aliases', [config.domain]);

    // ── Route53 alias ─────────────────────────────────────────────────────────

    const hostedZone =
      props.hostedZone ??
      route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: config.domain,
      });

    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: config.domain,
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(distribution),
      ),
    });

    // ── Outputs ───────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      exportName: `${this.stackName}-DistributionDomainName`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      exportName: `${this.stackName}-DistributionId`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      exportName: `${this.stackName}-FrontendBucketName`,
    });

    new cdk.CfnOutput(this, 'LandingBucketName', {
      value: landingBucket.bucketName,
      exportName: `${this.stackName}-LandingBucketName`,
    });
  }
}
