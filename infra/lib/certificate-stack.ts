import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface CertificateStackProps extends cdk.StackProps {
  config: EnvConfig;
}

/**
 * CertificateStack — provisions an ACM certificate in us-east-1.
 *
 * CloudFront requires certificates to be in us-east-1 regardless of where the
 * distribution is deployed.  This stack is always deployed with
 * `env: { region: 'us-east-1' }` in bin/fastspec.ts.
 *
 * The certificate is validated via DNS. CDK automatically creates the required
 * Route 53 validation CNAME record so no manual DNS step is needed.
 */
export class CertificateStack extends cdk.Stack {
  /** ACM certificate — pass to FrontendStack via crossRegionReferences. */
  readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    // Force region to us-east-1 regardless of caller's region
    super(scope, id, { ...props, env: { ...props.env, region: 'us-east-1' } });

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.config.domain,
    });

    this.certificate = new acm.Certificate(this, 'ViewerCert', {
      domainName: props.config.domain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
  }
}
