import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { getConfig } from '../lib/config';
import { DataStack } from '../lib/data-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { WakeStack } from '../lib/wake-stack';
import { TEST_SETTINGS } from './settings';

/**
 * Limits AWS enforces at deploy time but CDK doesn't check at synth time,
 * so unit tests pass while the real deployment fails. (An em dash in a
 * security-group rule description broke the 2026-09-27 deploy.)
 */

// EC2 security-group rule descriptions: < 256 chars from this set.
const SG_RULE_DESCRIPTION = /^[a-zA-Z0-9. _\-:/()#,@[\]+=&;{}!$*]{0,255}$/;

function prodTemplates(): Template[] {
  const app = new cdk.App();
  const config = getConfig('prod', TEST_SETTINGS);
  const data = new DataStack(app, 'FastSpec-Data-prod', { config });
  const lambda = new LambdaStack(app, 'FastSpec-Lambda-prod', {
    config,
    dbEndpoint: data.dbEndpoint,
    dbSecretArn: data.dbSecretArn,
    appDbSecretArn: data.appDbSecretArn,
    rdsInstanceId: data.rdsInstanceId,
  });
  const wake = new WakeStack(app, 'FastSpec-Wake-prod', { config, rdsInstanceId: data.rdsInstanceId });
  return [data, lambda, wake].map((stack) => Template.fromStack(stack));
}

function ruleDescriptions(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((item) => ruleDescriptions(item, found));
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if ('IpProtocol' in obj && typeof obj.Description === 'string') found.push(obj.Description);
    Object.values(obj).forEach((value) => ruleDescriptions(value, found));
  }
  return found;
}

test('security-group rule descriptions use only characters EC2 accepts', () => {
  const descriptions = prodTemplates().flatMap((t) => ruleDescriptions(t.toJSON()));
  expect(descriptions.length).toBeGreaterThan(0);
  for (const description of descriptions) {
    expect(description).toMatch(SG_RULE_DESCRIPTION);
  }
});
