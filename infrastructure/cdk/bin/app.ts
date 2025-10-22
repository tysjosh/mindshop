#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MindsDBRAGStack } from "../lib/mindsdb-rag-stack";

const app = new cdk.App();

// Get environment configuration from context or environment variables
const environment =
  app.node.tryGetContext("environment") || process.env.ENVIRONMENT || "dev";
const region =
  app.node.tryGetContext("region") ||
  process.env.CDK_DEFAULT_REGION ||
  "us-east-1";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region,
};

const stackName = `mindsdb-rag-${environment}`;

new MindsDBRAGStack(app, stackName, {
  env,
  stackName,
  environment,
  description: `MindsDB RAG Assistant infrastructure for ${environment} environment`,
  tags: {
    Environment: environment,
    Project: "MindsDB-RAG-Assistant",
    ManagedBy: "CDK",
  },
});
