import { DeploymentSettings } from '../lib/config';

/** Deployment settings used by every test that builds prod stacks. */
export const TEST_SETTINGS: DeploymentSettings = { domain: 'fastspec.example.com' };
