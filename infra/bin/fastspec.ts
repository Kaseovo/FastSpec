#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { resolveEnv, getConfig } from '../lib/config';
import { DataStack } from '../lib/data-stack';
import { ComputeStack } from '../lib/compute-stack';

const app = new cdk.App();
const env = resolveEnv(app);
const config = getConfig(env);

const dataStack = new DataStack(app, `FastSpec-Data-${env}`, { config });

new ComputeStack(app, `FastSpec-Compute-${env}`, {
  config,
  dbEndpoint: dataStack.dbEndpoint,
  redisEndpoint: dataStack.redisEndpoint,
});
