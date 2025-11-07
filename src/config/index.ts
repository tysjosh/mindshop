import { DatabaseConfig, RedisConfig, AWSConfig, MindsDBConfig, BedrockConfig } from '../types';

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
  enabled: boolean;
  enableMockAuth: boolean;
}

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
  cognito: CognitoConfig;
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
  
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID || '',
    clientId: process.env.COGNITO_CLIENT_ID || '',
    region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1',
    enabled: process.env.ENABLE_COGNITO_AUTH === 'true',
    enableMockAuth: process.env.DISABLE_AUTH_FOR_DEVELOPMENT === 'true' || 
                    (process.env.NODE_ENV === 'development' && process.env.ENABLE_COGNITO_AUTH !== 'true'),
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

/**
 * Validate Cognito configuration
 * Returns validation result with any errors
 */
export function validateCognitoConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Skip validation if Cognito is disabled or mock auth is enabled
  if (!config.cognito.enabled || config.cognito.enableMockAuth) {
    return { valid: true, errors: [] };
  }
  
  // Validate required fields when Cognito is enabled
  if (!config.cognito.userPoolId || config.cognito.userPoolId === '') {
    errors.push('COGNITO_USER_POOL_ID is required when ENABLE_COGNITO_AUTH=true');
  }
  
  if (!config.cognito.clientId || config.cognito.clientId === '') {
    errors.push('COGNITO_CLIENT_ID is required when ENABLE_COGNITO_AUTH=true');
  }
  
  if (!config.cognito.region || config.cognito.region === '') {
    errors.push('COGNITO_REGION is required when ENABLE_COGNITO_AUTH=true');
  }
  
  // Validate User Pool ID format (should be like us-east-1_XXXXXXXXX)
  if (config.cognito.userPoolId && !config.cognito.userPoolId.match(/^[a-z]{2}-[a-z]+-\d+_[A-Za-z0-9]+$/)) {
    errors.push('COGNITO_USER_POOL_ID has invalid format (expected: region_poolId, e.g., us-east-1_XXXXXXXXX)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate all required configuration at startup
 * Logs warnings for missing optional config and errors for missing required config
 */
export function validateConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate Cognito configuration
  const cognitoValidation = validateCognitoConfig();
  if (!cognitoValidation.valid) {
    errors.push(...cognitoValidation.errors);
  }
  
  // Validate database configuration
  if (!config.database.host) {
    errors.push('DB_HOST is required');
  }
  if (!config.database.database) {
    errors.push('DB_NAME is required');
  }
  
  // Validate security configuration
  if (config.nodeEnv === 'production') {
    if (config.security.jwtSecret === 'your-secret-key') {
      errors.push('JWT_SECRET must be changed in production');
    }
    if (config.security.encryptionKey === 'your-encryption-key') {
      errors.push('ENCRYPTION_KEY must be changed in production');
    }
  }
  
  // Warn about optional configurations
  if (!config.mindsdb.apiKey && config.nodeEnv === 'production') {
    warnings.push('MINDSDB_API_KEY is not set (may be required for production MindsDB instances)');
  }
  
  if (!config.bedrock.agentId && config.nodeEnv === 'production') {
    warnings.push('BEDROCK_AGENT_ID is not set (Bedrock Agent features will be unavailable)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log configuration status at startup
 * Shows which features are enabled/disabled and any configuration issues
 */
export function logConfigStatus(): void {
  console.log('\n=== Configuration Status ===');
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Port: ${config.port}`);
  console.log(`Log Level: ${config.logLevel}`);
  
  console.log('\n--- Authentication ---');
  if (config.cognito.enableMockAuth) {
    console.log('🔓 Mock Authentication: ENABLED (development mode)');
    console.log('   Cognito authentication is disabled for local development');
  } else if (config.cognito.enabled) {
    console.log('🔒 Cognito Authentication: ENABLED');
    console.log(`   User Pool ID: ${config.cognito.userPoolId}`);
    console.log(`   Client ID: ${config.cognito.clientId}`);
    console.log(`   Region: ${config.cognito.region}`);
  } else {
    console.log('⚠️  Cognito Authentication: DISABLED');
    console.log('   Set ENABLE_COGNITO_AUTH=true to enable');
  }
  
  console.log('\n--- Database ---');
  console.log(`PostgreSQL: ${config.database.host}:${config.database.port}/${config.database.database}`);
  console.log(`Redis: ${config.redis.host}:${config.redis.port}`);
  
  console.log('\n--- AWS Services ---');
  console.log(`Region: ${config.aws.region}`);
  console.log(`Bedrock Model: ${config.bedrock.modelId}`);
  console.log(`MindsDB Endpoint: ${config.mindsdb.endpoint}`);
  
  console.log('\n--- Features ---');
  console.log(`Metrics: ${config.monitoring.metricsEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Tracing: ${config.monitoring.tracingEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Postgres Sessions: ${process.env.USE_POSTGRES_SESSIONS === 'true' ? 'ENABLED' : 'DISABLED'}`);
  
  // Validate and show any errors or warnings
  const validation = validateConfig();
  
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Configuration Warnings:');
    validation.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
  
  if (validation.errors.length > 0) {
    console.log('\n❌ Configuration Errors:');
    validation.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  if (validation.valid && validation.warnings.length === 0) {
    console.log('\n✅ Configuration is valid');
  }
  
  console.log('===========================\n');
}

export default config;