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
   * The certificate covers both `config.domain` and `config.appDomain` via SAN,
   * so the same ARN is used for both CloudFront distributions.
   * Injected directly into the CloudFormation Distribution resource via L1
   * property override — bypasses CDK's cross-region certificate region check
   * and avoids CrossRegionExportWriter entirely.
   */
  certificateArn: string;
  /** DNS name of the ALB in ComputeStack — used for /api*, /auth*, /mcp* origins. */
  albDnsName: string;
  /**
   * Route53 hosted zone for the environment domain.
   * Inject in tests via `HostedZone.fromHostedZoneAttributes`.
   * Omit in production — the stack will look it up via `HostedZone.fromLookup`.
   */
  hostedZone?: route53.IHostedZone;
}

/**
 * FrontendStack — two S3 buckets, two CloudFront distributions, two Route53 aliases.
 *
 * LandingDistribution  →  fastspec.kaseovo.com   →  LandingBucket (multi-page static site)
 * AppDistribution      →  app.fastspec.kaseovo.com →  FrontendBucket (Vue SPA)
 *
 * Both distributions also proxy /api*, /auth*, /mcp* to the ALB so relative API
 * calls (/api/specs, /auth/...) work from either origin without any code changes.
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

    // ── ALB origin (shared by both distributions for /api*, /auth*, /mcp*) ────

    const albOrigin = new origins.HttpOrigin(props.albDnsName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    });

    // Shared ALB behavior config reused across both distributions.
    const albBehaviorOptions = {
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

    // ── CloudFront Function: SPA rewrite for AppDistribution ──────────────────
    //
    // The SPA (Vue app) is served at the domain root (app.fastspec.kaseovo.com).
    // - Static assets have file extensions → pass through unchanged
    // - Extensionless paths → rewrite to /index.html (SPA entry point)
    //   (/dashboard, /123/preview, etc.)
    // No prefix stripping is needed because the app lives at domain root, not /specs*.
    const spaRewriteFn = new cloudfront.Function(this, 'SpaRewriteFn', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var uri = event.request.uri;
  if (!uri.includes('.')) {
    uri = '/index.html';
  }
  event.request.uri = uri;
  return event.request;
}
      `.trim()),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // ── CloudFront Function: /specs* redirect on LandingDistribution ──────────
    //
    // Any request to fastspec.kaseovo.com/specs* (e.g. existing bookmarks or
    // shared links) is permanently redirected to the new SPA domain so users
    // land on the correct site without a 404.
    const specsRedirectFn = new cloudfront.Function(this, 'SpecsRedirectFn', {
      code: cloudfront.FunctionCode.fromInline(`
var APP_DOMAIN = 'https://${config.appDomain}';
function handler(event) {
  var uri = event.request.uri;
  // Strip /specs prefix and redirect to the app domain
  var newPath = uri.replace(/^\\/specs/, '') || '/';
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: APP_DOMAIN + newPath },
    },
  };
}
      `.trim()),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // ── Landing Distribution ──────────────────────────────────────────────────
    //
    // Serves the marketing / landing-page site at config.domain.
    // `certificate` and `domainNames` are omitted from L2 props to avoid CDK's
    // synth-time us-east-1 cert validation.  Patched in at L1 below.

    const landingDistribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `FastSpec-Landing-${config.env} #${deployId}`,
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
        // Redirect legacy /specs* URLs (bookmarks, shared links) to the new app domain.
        '/specs*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(landingBucket, {
            originAccessControl: oac,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          functionAssociations: [{
            function: specsRedirectFn,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
        '/api*': {
          origin: albOrigin,
          ...albBehaviorOptions,
        },
        '/auth*': {
          origin: albOrigin,
          ...albBehaviorOptions,
        },
        '/mcp*': {
          origin: albOrigin,
          ...albBehaviorOptions,
        },
      },
    });

    const cfnLanding = landingDistribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnLanding.addPropertyOverride('DistributionConfig.ViewerCertificate', {
      AcmCertificateArn: props.certificateArn,
      SslSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.2_2021',
    });
    cfnLanding.addPropertyOverride('DistributionConfig.Aliases', [config.domain]);

    // ── App Distribution ──────────────────────────────────────────────────────
    //
    // Serves the Vue SPA at config.appDomain (app.fastspec.kaseovo.com).
    // Also proxies /api*, /auth*, /mcp* to the ALB so the SPA's relative API
    // calls work without any absolute-URL configuration.

    const appDistribution = new cloudfront.Distribution(this, 'AppDistribution', {
      comment: `FastSpec-App-${config.env} #${deployId}`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
        functionAssociations: [{
          function: spaRewriteFn,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        '/api*': {
          origin: albOrigin,
          ...albBehaviorOptions,
        },
        '/auth*': {
          origin: albOrigin,
          ...albBehaviorOptions,
        },
        '/mcp*': {
          origin: albOrigin,
          ...albBehaviorOptions,
        },
      },
    });

    const cfnApp = appDistribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnApp.addPropertyOverride('DistributionConfig.ViewerCertificate', {
      AcmCertificateArn: props.certificateArn,
      SslSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.2_2021',
    });
    cfnApp.addPropertyOverride('DistributionConfig.Aliases', [config.appDomain]);

    // ── Route53 aliases ───────────────────────────────────────────────────────

    const hostedZone =
      props.hostedZone ??
      route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: config.domain,
      });

    // Keep the logical ID 'AliasRecord' (same as the original single-distribution
    // record) so CloudFormation issues a single UPSERT rather than DELETE+CREATE,
    // eliminating any DNS gap for fastspec.kaseovo.com during the rollout.
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: config.domain,
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(landingDistribution),
      ),
    });

    new route53.ARecord(this, 'AppAliasRecord', {
      zone: hostedZone,
      recordName: config.appDomain,
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(appDistribution),
      ),
    });

    // ── Outputs ───────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'LandingDistributionDomainName', {
      value: landingDistribution.distributionDomainName,
      exportName: `${this.stackName}-LandingDistributionDomainName`,
    });

    new cdk.CfnOutput(this, 'LandingDistributionId', {
      value: landingDistribution.distributionId,
      exportName: `${this.stackName}-LandingDistributionId`,
    });

    new cdk.CfnOutput(this, 'AppDistributionDomainName', {
      value: appDistribution.distributionDomainName,
      exportName: `${this.stackName}-AppDistributionDomainName`,
    });

    new cdk.CfnOutput(this, 'AppDistributionId', {
      value: appDistribution.distributionId,
      exportName: `${this.stackName}-AppDistributionId`,
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
