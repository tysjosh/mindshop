// Stub types for AWS SDK packages that may not be installed
// This allows TypeScript compilation to succeed

export interface QBusinessClient {
  send(command: any): Promise<any>;
}

export interface ChatSyncCommand {
  constructor(input: any): void;
}

export interface GetApplicationCommand {
  constructor(input: any): void;
}

export interface BedrockAgentRuntimeClient {
  send(command: any): Promise<any>;
}

export interface InvokeAgentCommand {
  constructor(input: any): void;
}

export interface InvokeAgentCommandInput {
  agentId: string;
  agentAliasId: string;
  sessionId: string;
  inputText: string;
  sessionState?: any;
}

export interface BedrockRuntimeClient {
  send(command: any): Promise<any>;
}

export interface InvokeModelCommand {
  constructor(input: any): void;
}

export interface DynamoDBClient {
  send(command: any): Promise<any>;
}

export interface CloudWatchLogsClient {
  send(command: any): Promise<any>;
}

export const marshall = (obj: any): any => obj;
export const unmarshall = (obj: any): any => obj;