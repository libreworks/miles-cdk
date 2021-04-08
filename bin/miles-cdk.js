#!/usr/bin/env node

const cdk = require('@aws-cdk/core');
const { MilesCdkStack } = require('../lib/miles-cdk-stack');

const app = new cdk.App();
new MilesCdkStack(app, 'MilesCdkStack');
