#!/usr/bin/env node

const cdk = require("@aws-cdk/core");
const { MilesCdkStack } = require("../lib/miles-cdk-stack");

const account = "907147934795";
const region = "us-east-1";

const app = new cdk.App();
const envProps = {
  env: {
    account: account || process.env.CDK_DEFAULT_ACCOUNT,
    region: region || process.env.CDK_DEFAULT_REGION,
  },
};
new MilesCdkStack(app, "MilesCdkStack", envProps);
