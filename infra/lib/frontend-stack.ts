import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvConfig, hostedZoneFor } from './config';

export interface FrontendStackProps extends cdk.StackProps {
  config: EnvConfig;
  /**
   * ARN of the ACM certificate in us-east-1.
   * Injected directly into the CloudFormation Distribution resource via L1
   * property override — bypasses CDK's cross-region certificate region check
   * and avoids CrossRegionExportWriter entirely.
   */
  certificateArn: string;
  /** Full Lambda Function URL (https://…) from LambdaStack — used for /api*, /auth*, /mcp* origins. */
  lambdaFunctionUrl: string;
  /**
   * Route53 hosted zone for the environment domain.
   * Inject in tests via `HostedZone.fromHostedZoneAttributes`.
   * Omit in production — resolved from the config (`hostedZoneFor`).
   */
  hostedZone?: route53.IHostedZone;
}

/**
 * FrontendStack — S3 buckets, CloudFront distribution, and Route53 alias.
 *
 * Two private S3 buckets (SPA assets + landing-page assets) served through a
 * single CloudFront distribution that also proxies `/api*`, `/auth*`, and
 * `/mcp*` to the Lambda Function URL.
 *
 * - Default behavior → LandingBucket (multi-page static site)
 * - /specs* → FrontendBucket (Vue SPA)
 * - /api*, /auth*, /mcp* → Lambda Function URL (HTTPS-only)
 *
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

    // ── Lambda origin (used for /api*, /auth*, /mcp*) ────────────────────────
    // Lambda Function URLs are of the form https://<id>.lambda-url.<region>.on.aws/
    // We strip the scheme and trailing slash to get the hostname for HttpOrigin.
    // Using cdk.Fn.select + cdk.Fn.split avoids new URL() which fails on CDK tokens.
    const lambdaHostname = cdk.Fn.select(
      2,
      cdk.Fn.split('/', props.lambdaFunctionUrl),
    );
    const lambdaOrigin = new origins.HttpOrigin(lambdaHostname, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    // Shared Lambda behavior config.
    const lambdaBehaviorOptions = {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      originRequestPolicy:
        cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    } as const;

    // Embed the CI run number (deployId context) as the distribution comment.
    // This guarantees a non-empty CloudFormation changeset on every CI run,
    // which forces CloudFormation to re-apply all distribution properties and
    // automatically reconcile any drift introduced by manual console edits.
    const deployId = this.node.tryGetContext('deployId') ?? 'local';

    // ── CloudFront Function: Landing page URL rewrite ─────────────────────────
    //
    // Replicates nginx `try_files $uri $uri/ $uri/index.html =404` for the
    // landing page (multi-page static site — each route has its own index.html):
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

    // SPA rewrite for frontendBucket:
    // - Strip the /specs prefix so S3 keys resolve correctly
    //   (/specs/assets/foo.css → /assets/foo.css)
    // - Rewrite any extensionless path to /index.html (SPA entry point)
    //   (/specs, /specs/123, /specs/123/preview → /index.html)
    const spaRewriteFn = new cloudfront.Function(this, 'SpaRewriteFn', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var uri = event.request.uri;
  // Strip leading /specs prefix
  uri = uri.replace(/^\\/specs/, '') || '/';
  // Extensionless paths → SPA entry point
  if (!uri.includes('.')) {
    uri = '/index.html';
  }
  event.request.uri = uri;
  return event.request;
}
      `.trim()),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // ── CloudFront Distribution ───────────────────────────────────────────────

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `FastSpec-${config.env} #${deployId}`,
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
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
          functionAssociations: [{
            function: spaRewriteFn,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
        '/api*': {
          origin: lambdaOrigin,
          ...lambdaBehaviorOptions,
        },
        '/auth*': {
          origin: lambdaOrigin,
          ...lambdaBehaviorOptions,
        },
        '/mcp*': {
          origin: lambdaOrigin,
          ...lambdaBehaviorOptions,
        },
      },
    });

    // Patch ViewerCertificate and Aliases directly on the L1 resource.
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyOverride('DistributionConfig.ViewerCertificate', {
      AcmCertificateArn: props.certificateArn,
      SslSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.2_2021',
    });
    cfnDistribution.addPropertyOverride('DistributionConfig.Aliases', [config.domain]);

    // ── Route53 alias ─────────────────────────────────────────────────────────

    const hostedZone = props.hostedZone ?? hostedZoneFor(this, config);

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
