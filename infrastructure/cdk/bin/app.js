#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const mindsdb_rag_stack_1 = require("../lib/mindsdb-rag-stack");
const app = new cdk.App();
// Get environment configuration from context or environment variables
const environment = app.node.tryGetContext("environment") || process.env.ENVIRONMENT || "dev";
const region = app.node.tryGetContext("region") ||
    process.env.CDK_DEFAULT_REGION ||
    "us-east-1";
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region,
};
const stackName = `mindsdb-rag-${environment}`;
new mindsdb_rag_stack_1.MindsDBRAGStack(app, stackName, {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsZ0VBQTJEO0FBRTNELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLHNFQUFzRTtBQUN0RSxNQUFNLFdBQVcsR0FDZixHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUM7QUFDNUUsTUFBTSxNQUFNLEdBQ1YsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDO0lBQ2hDLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCO0lBQzlCLFdBQVcsQ0FBQztBQUVkLE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO0lBQ3hDLE1BQU07Q0FDUCxDQUFDO0FBRUYsTUFBTSxTQUFTLEdBQUcsZUFBZSxXQUFXLEVBQUUsQ0FBQztBQUUvQyxJQUFJLG1DQUFlLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRTtJQUNsQyxHQUFHO0lBQ0gsU0FBUztJQUNULFdBQVc7SUFDWCxXQUFXLEVBQUUsNENBQTRDLFdBQVcsY0FBYztJQUNsRixJQUFJLEVBQUU7UUFDSixXQUFXLEVBQUUsV0FBVztRQUN4QixPQUFPLEVBQUUsdUJBQXVCO1FBQ2hDLFNBQVMsRUFBRSxLQUFLO0tBQ2pCO0NBQ0YsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0IFwic291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyXCI7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQgeyBNaW5kc0RCUkFHU3RhY2sgfSBmcm9tIFwiLi4vbGliL21pbmRzZGItcmFnLXN0YWNrXCI7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIEdldCBlbnZpcm9ubWVudCBjb25maWd1cmF0aW9uIGZyb20gY29udGV4dCBvciBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbmNvbnN0IGVudmlyb25tZW50ID1cbiAgYXBwLm5vZGUudHJ5R2V0Q29udGV4dChcImVudmlyb25tZW50XCIpIHx8IHByb2Nlc3MuZW52LkVOVklST05NRU5UIHx8IFwiZGV2XCI7XG5jb25zdCByZWdpb24gPVxuICBhcHAubm9kZS50cnlHZXRDb250ZXh0KFwicmVnaW9uXCIpIHx8XG4gIHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fFxuICBcInVzLWVhc3QtMVwiO1xuXG5jb25zdCBlbnYgPSB7XG4gIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXG4gIHJlZ2lvbixcbn07XG5cbmNvbnN0IHN0YWNrTmFtZSA9IGBtaW5kc2RiLXJhZy0ke2Vudmlyb25tZW50fWA7XG5cbm5ldyBNaW5kc0RCUkFHU3RhY2soYXBwLCBzdGFja05hbWUsIHtcbiAgZW52LFxuICBzdGFja05hbWUsXG4gIGVudmlyb25tZW50LFxuICBkZXNjcmlwdGlvbjogYE1pbmRzREIgUkFHIEFzc2lzdGFudCBpbmZyYXN0cnVjdHVyZSBmb3IgJHtlbnZpcm9ubWVudH0gZW52aXJvbm1lbnRgLFxuICB0YWdzOiB7XG4gICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIFByb2plY3Q6IFwiTWluZHNEQi1SQUctQXNzaXN0YW50XCIsXG4gICAgTWFuYWdlZEJ5OiBcIkNES1wiLFxuICB9LFxufSk7XG4iXX0=