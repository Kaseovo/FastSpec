import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { EnvConfig, hostedZoneFor } from './config';

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
 * ## Two-certificate strategy (transitional)
 *
 * `ViewerCert` — original single-domain cert for `config.domain`.
 * `ViewerCertV2` — multi-domain cert (covers domain + app.domain SAN).
 *   Kept with RETAIN deletion policy so CloudFormation does not attempt to
 *   delete it while any CloudFront distribution may still reference it.
 *   Can be removed in a follow-up once confirmed no distribution uses it.
 */
export class CertificateStack extends cdk.Stack {
  /** ACM certificate — pass to FrontendStack via --context certificateArn=<value>. */
  readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    // Force region to us-east-1 regardless of caller's region
    super(scope, id, { ...props, env: { ...props.env, region: 'us-east-1' } });

    const hostedZone = hostedZoneFor(this, props.config);

    // ── Primary certificate (single domain) ───────────────────────────────────
    this.certificate = new acm.Certificate(this, 'ViewerCert', {
      domainName: props.config.domain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      exportName: `${this.stackName}-CertificateArn`,
      description: 'ACM certificate ARN — pass to FrontendStack via --context certificateArn=<value>',
    });

    // ── V2 certificate (legacy multi-domain, kept with RETAIN) ────────────────
    // This cert was created for the multi-domain setup. Kept here so
    // CloudFormation does not try to delete it (RETAIN policy). Safe to remove
    // once no CloudFront distribution references it.
    const certV2 = new acm.Certificate(this, 'ViewerCertV2', {
      domainName: props.config.domain,
      subjectAlternativeNames: [`app.${props.config.domain}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
    (certV2.node.defaultChild as acm.CfnCertificate).cfnOptions.deletionPolicy =
      cdk.CfnDeletionPolicy.RETAIN;

    new cdk.CfnOutput(this, 'CertificateArnV2', {
      value: certV2.certificateArn,
      exportName: `${this.stackName}-CertificateArnV2`,
      description: 'Legacy multi-domain cert (RETAIN) — will be removed in a follow-up.',
    });
  }
}
