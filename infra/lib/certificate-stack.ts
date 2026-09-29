import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { EnvConfig, hostedZoneFor } from './config';

export interface CertificateStackProps extends cdk.StackProps {
  config: EnvConfig;
}

/**
 * CertificateStack - the ACM certificate for CloudFront, in us-east-1.
 *
 * CloudFront requires certificates to be in us-east-1 regardless of where the
 * distribution is deployed.  This stack is always deployed with
 * `env: { region: 'us-east-1' }` in bin/fastspec.ts.
 *
 * DNS validation: through the Route 53 hosted zone when there is one; with
 * `externalDns`, ACM waits for you to create its validation CNAME at your
 * DNS provider (ACM console, or `aws acm describe-certificate`). ACM uses the
 * same record for every certificate of a domain in an account, and keeps
 * using it to renew.
 */
export class CertificateStack extends cdk.Stack {
  /** ACM certificate - pass to FrontendStack via --context certificateArn=<value>. */
  readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    // Force region to us-east-1 regardless of caller's region
    super(scope, id, { ...props, env: { ...props.env, region: 'us-east-1' } });

    const { config } = props;
    this.certificate = new acm.Certificate(this, 'ViewerCert', {
      domainName: config.domain,
      validation: config.externalDns
        ? acm.CertificateValidation.fromDns()
        : acm.CertificateValidation.fromDns(hostedZoneFor(this, config)),
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      exportName: `${this.stackName}-CertificateArn`,
      description: 'ACM certificate ARN - pass to FrontendStack via --context certificateArn=<value>',
    });
  }
}
