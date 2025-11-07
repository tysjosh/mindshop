#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MindsDBRAGStack } from "../lib/mindsdb-rag-stack";
import { WidgetCdnStack } from "../lib/widget-cdn-stack";

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

// Widget CDN Stack
const widgetEnvironment = app.node.tryGetContext("widgetEnvironment") || "development";
const cdnDomain = app.node.tryGetContext("cdnDomain");
const certificateArn = app.node.tryGetContext("certificateArn");

new WidgetCdnStack(app, `rag-widget-cdn-${widgetEnvironment}`, {
  env,
  stackName: `rag-widget-cdn-${widgetEnvironment}`,
  environment: widgetEnvironment as 'development' | 'staging' | 'production',
  domainName: cdnDomain,
  certificateArn: certificateArn,
  description: `RAG Assistant Widget CDN for ${widgetEnvironment} environment`,
  tags: {
    Environment: widgetEnvironment,
    Project: "RAG-Assistant-Widget",
    ManagedBy: "CDK",
  },
});
