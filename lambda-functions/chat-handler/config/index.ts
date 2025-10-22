import { DatabaseConfig, RedisConfig, AWSConfig, MindsDBConfig, BedrockConfig } from '../types';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  aws: AWSConfig & {
    stepFunctions: {
      documentIngestionArn: string;
      batchIngestionArn: string;
    };
    s3: {
      documentBucket: string;
      region: string;
    };
    sns: {
      successTopicArn: string;
    };
  };
  s3?: {
    modelArtifactsBucket?: string;
  };
  kms?: {
    modelArtifactsKey?: string;
  };
  mindsdb: MindsDBConfig;
  bedrock: BedrockConfig & {
    agentId: string;
    agentAliasId: string;
  };
  dynamodb: {
    sessionTableName: string;
    region: string;
  };
  security: {
    jwtSecret: string;
    encryptionKey: string;
    corsOrigins: string[];
  };
  cache: {
    defaultTtl: number;
    maxMemory: string;
  };
  monitoring: {
    metricsEnabled: boolean;
    tracingEnabled: boolean;
  };
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'mindsdb_rag',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
    tls: process.env.REDIS_TLS === 'true',
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'mindsdb-rag',
  },
  
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    stepFunctions: {
      documentIngestionArn: process.env.DOCUMENT_INGESTION_STATE_MACHINE_ARN || '',
      batchIngestionArn: process.env.BATCH_INGESTION_STATE_MACHINE_ARN || '',
    },
    s3: {
      documentBucket: process.env.DOCUMENT_BUCKET || 'mindsdb-rag-documents-dev',
      region: process.env.AWS_REGION || 'us-east-1',
    },
    sns: {
      successTopicArn: process.env.SUCCESS_TOPIC_ARN || '',
    },
  },
  
  mindsdb: {
    endpoint: process.env.MINDSDB_ENDPOINT || 'http://localhost:47334',
    apiKey: process.env.MINDSDB_API_KEY || '',
    username: process.env.MINDSDB_USERNAME || 'mindsdb',
    password: process.env.MINDSDB_PASSWORD || '',
    timeout: parseInt(process.env.MINDSDB_TIMEOUT || '30000', 10),
    embeddingModel: process.env.MINDSDB_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
    batchSize: parseInt(process.env.MINDSDB_BATCH_SIZE || '10', 10),
    maxConcurrency: parseInt(process.env.MINDSDB_MAX_CONCURRENCY || '5', 10),
  },
  
  bedrock: {
    region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1',
    modelId: process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0',
    maxTokens: parseInt(process.env.BEDROCK_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.BEDROCK_TEMPERATURE || '0.7'),
    agentId: process.env.BEDROCK_AGENT_ID || '',
    agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID || 'TSTALIASID',
  },
  
  dynamodb: {
    sessionTableName: process.env.SESSION_TABLE_NAME || 'mindsdb-rag-sessions-dev',
    region: process.env.AWS_REGION || 'us-east-1',
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    encryptionKey: process.env.ENCRYPTION_KEY || 'your-encryption-key',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  
  cache: {
    defaultTtl: parseInt(process.env.CACHE_TTL || '3600', 10),
    maxMemory: process.env.CACHE_MAX_MEMORY || '256mb',
  },
  
  monitoring: {
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    tracingEnabled: process.env.TRACING_ENABLED === 'true',
  },
  
  s3: {
    modelArtifactsBucket: process.env.MODEL_ARTIFACTS_BUCKET || 'mindsdb-model-artifacts',
  },
  
  kms: {
    modelArtifactsKey: process.env.MODEL_ARTIFACTS_KMS_KEY,
  },
};

export default config;