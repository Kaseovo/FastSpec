import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface CertificateStackProps extends cdk.StackProps {
  config: EnvConfig;
}

/**
 * CertificateStack — provisions ACM certificates in us-east-1 for CloudFront.
 *
 * CloudFront requires certificates to be in us-east-1 regardless of where the
 * distribution is deployed.  This stack is always deployed with
 * `env: { region: 'us-east-1' }` in bin/fastspec.ts.
 *
 * ## Two-certificate strategy
 *
 * The original `ViewerCert` covers only `config.domain` and must not be
 * modified (adding SANs forces an ACM resource replacement; ACM refuses to
 * delete a cert that is still attached to a live CloudFront distribution,
 * deadlocking the CertStack changeset).
 *
 * `ViewerCertV2` covers both `config.domain` and `config.appDomain` via SAN.
 * FrontendStack should be deployed with the `CertificateArnV2` output value.
 * Once the old single CloudFront distribution has been replaced by the two new
 * distributions, the `ViewerCert` construct can be removed from this stack in a
 * follow-up deploy (ACM will then allow the deletion because nothing references
 * it).
 */
export class CertificateStack extends cdk.Stack {
  /**
   * Original single-domain certificate.
   * @deprecated Use `certificateV2` for new distributions.
   */
  readonly certificate: acm.Certificate;

  /** Multi-domain certificate (covers domain + appDomain via SAN). */
  readonly certificateV2: acm.Certificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    // Force region to us-east-1 regardless of caller's region
    super(scope, id, { ...props, env: { ...props.env, region: 'us-east-1' } });

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.config.domain,
    });

    // ── Original certificate (single domain) ──────────────────────────────────
    // Keep untouched so ACM does not attempt to replace/delete it while the old
    // CloudFront distribution still references it.  RETAIN ensures CloudFormation
    // never issues a DELETE even if this construct is later removed from the stack.
    this.certificate = new acm.Certificate(this, 'ViewerCert', {
      domainName: props.config.domain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
    (this.certificate.node.defaultChild as acm.CfnCertificate).cfnOptions.deletionPolicy =
      cdk.CfnDeletionPolicy.RETAIN;

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      exportName: `${this.stackName}-CertificateArn`,
      description: 'Legacy single-domain cert — do not use for new distributions.',
    });

    // ── V2 certificate (covers both domain + appDomain via SAN) ──────────────
    // This is the cert used by both LandingDistribution and AppDistribution in
    // FrontendStack.  Pass `CertificateArnV2` to the deploy step as
    // --context certificateArn=<value>.
    this.certificateV2 = new acm.Certificate(this, 'ViewerCertV2', {
      domainName: props.config.domain,
      subjectAlternativeNames: [props.config.appDomain],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    new cdk.CfnOutput(this, 'CertificateArnV2', {
      value: this.certificateV2.certificateArn,
      exportName: `${this.stackName}-CertificateArnV2`,
      description: 'Multi-domain cert (domain + appDomain SAN) — pass to FrontendStack via --context certificateArn=<value>',
    });
  }
}
