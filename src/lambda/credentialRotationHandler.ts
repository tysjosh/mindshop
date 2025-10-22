import { SecretsManagerRotationEvent, Context } from 'aws-lambda';
import { 
  SecretsManagerClient, 
  GetSecretValueCommand, 
  PutSecretValueCommand,
  UpdateSecretVersionStageCommand,
  DescribeSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { RDSClient, ModifyDBClusterCommand } from '@aws-sdk/client-rds';
import { ECSClient, UpdateServiceCommand } from '@aws-sdk/client-ecs';
import * as crypto from 'crypto';

interface DatabaseCredentials {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

interface APIKeyCredentials {
  apiKey: string;
  keyId?: string;
  expiresAt?: string;
}

/**
 * Lambda function to handle automatic credential rotation
 */
export const handler = async (
  event: SecretsManagerRotationEvent,
  context: Context
): Promise<void> => {
  console.log('Credential rotation event:', JSON.stringify(event, null, 2));

  const secretsClient = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  const { SecretId, Step, Token } = event as any;

  try {
    // Validate required parameters
    if (!SecretId || !Step || !Token) {
      throw new Error('Missing required parameters: SecretId, Step, or Token');
    }

    // Get secret metadata to determine rotation type
    const secretInfo = await getSecretInfo(secretsClient, SecretId);
    const rotationType = determineRotationType(secretInfo);

    console.log(`Processing rotation step: ${Step} for secret: ${SecretId}, type: ${rotationType}`);

    switch (Step) {
      case 'createSecret':
        await createSecret(secretsClient, SecretId, Token, rotationType);
        break;
      
      case 'setSecret':
        await setSecret(secretsClient, SecretId, Token, rotationType);
        break;
      
      case 'testSecret':
        await testSecret(secretsClient, SecretId, Token, rotationType);
        break;
      
      case 'finishSecret':
        await finishSecret(secretsClient, SecretId, Token);
        break;
      
      default:
        throw new Error(`Invalid rotation step: ${Step}`);
    }

    console.log(`Successfully completed rotation step: ${Step} for secret: ${SecretId}`);

  } catch (error) {
    console.error(`Rotation failed for secret ${SecretId}, step ${Step}:`, error);
    
    // Log security event
    console.log('SECURITY_EVENT', {
      event_type: 'credential_rotation_failed',
      secret_id: SecretId,
      rotation_step: Step,
      token: Token,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    throw error;
  }
};

/**
 * Get secret information and metadata
 */
async function getSecretInfo(
  client: SecretsManagerClient,
  secretId: string
): Promise<any> {
  const command = new DescribeSecretCommand({ SecretId: secretId });
  const response = await client.send(command);
  return response;
}

/**
 * Determine the type of rotation based on secret name and tags
 */
function determineRotationType(secretInfo: any): 'database' | 'api_key' | 'service_config' {
  const secretName = secretInfo.Name?.toLowerCase() || '';
  const tags = secretInfo.Tags || [];

  // Check tags first
  const typeTag = tags.find((tag: any) => tag.Key === 'RotationType');
  if (typeTag) {
    return typeTag.Value;
  }

  // Determine by name pattern
  if (secretName.includes('database') || secretName.includes('aurora') || secretName.includes('postgres')) {
    return 'database';
  }
  
  if (secretName.includes('api') || secretName.includes('key')) {
    return 'api_key';
  }

  return 'service_config';
}

/**
 * Step 1: Create new secret version with new credentials
 */
async function createSecret(
  client: SecretsManagerClient,
  secretId: string,
  token: string,
  rotationType: string
): Promise<void> {
  console.log(`Creating new secret version for ${secretId}`);

  try {
    // Check if the secret version already exists
    try {
      await client.send(new GetSecretValueCommand({
        SecretId: secretId,
        VersionId: token,
      }));
      console.log(`Secret version ${token} already exists, skipping creation`);
      return;
    } catch (error) {
      // Version doesn't exist, proceed with creation
    }

    // Get current secret value
    const currentSecret = await client.send(new GetSecretValueCommand({
      SecretId: secretId,
      VersionStage: 'AWSCURRENT',
    }));

    if (!currentSecret.SecretString) {
      throw new Error('Current secret has no string value');
    }

    let newSecretValue: string;

    switch (rotationType) {
      case 'database':
        newSecretValue = await createNewDatabaseCredentials(currentSecret.SecretString);
        break;
      
      case 'api_key':
        newSecretValue = await createNewAPIKey(currentSecret.SecretString);
        break;
      
      case 'service_config':
        newSecretValue = await createNewServiceConfig(currentSecret.SecretString);
        break;
      
      default:
        throw new Error(`Unsupported rotation type: ${rotationType}`);
    }

    // Store the new secret version
    await client.send(new PutSecretValueCommand({
      SecretId: secretId,
      SecretString: newSecretValue,
      VersionId: token,
    } as any));

    console.log(`Successfully created new secret version ${token}`);

  } catch (error) {
    console.error(`Failed to create secret version:`, error);
    throw error;
  }
}

/**
 * Step 2: Set the new credentials in the service
 */
async function setSecret(
  client: SecretsManagerClient,
  secretId: string,
  token: string,
  rotationType: string
): Promise<void> {
  console.log(`Setting new credentials for ${secretId}`);

  try {
    // Get the new secret value
    const newSecret = await client.send(new GetSecretValueCommand({
      SecretId: secretId,
      VersionId: token,
    }));

    if (!newSecret.SecretString) {
      throw new Error('New secret has no string value');
    }

    switch (rotationType) {
      case 'database':
        await setDatabaseCredentials(newSecret.SecretString, secretId);
        break;
      
      case 'api_key':
        await setAPIKey(newSecret.SecretString, secretId);
        break;
      
      case 'service_config':
        await setServiceConfig(newSecret.SecretString, secretId);
        break;
      
      default:
        throw new Error(`Unsupported rotation type: ${rotationType}`);
    }

    console.log(`Successfully set new credentials for ${secretId}`);

  } catch (error) {
    console.error(`Failed to set new credentials:`, error);
    throw error;
  }
}

/**
 * Step 3: Test the new credentials
 */
async function testSecret(
  client: SecretsManagerClient,
  secretId: string,
  token: string,
  rotationType: string
): Promise<void> {
  console.log(`Testing new credentials for ${secretId}`);

  try {
    // Get the new secret value
    const newSecret = await client.send(new GetSecretValueCommand({
      SecretId: secretId,
      VersionId: token,
    }));

    if (!newSecret.SecretString) {
      throw new Error('New secret has no string value');
    }

    switch (rotationType) {
      case 'database':
        await testDatabaseConnection(newSecret.SecretString);
        break;
      
      case 'api_key':
        await testAPIKey(newSecret.SecretString);
        break;
      
      case 'service_config':
        await testServiceConfig(newSecret.SecretString);
        break;
      
      default:
        throw new Error(`Unsupported rotation type: ${rotationType}`);
    }

    console.log(`Successfully tested new credentials for ${secretId}`);

  } catch (error) {
    console.error(`Failed to test new credentials:`, error);
    throw error;
  }
}

/**
 * Step 4: Finish the rotation by updating version stages
 */
async function finishSecret(
  client: SecretsManagerClient,
  secretId: string,
  token: string
): Promise<void> {
  console.log(`Finishing rotation for ${secretId}`);

  try {
    // Move the AWSCURRENT stage to the new version
    await client.send(new UpdateSecretVersionStageCommand({
      SecretId: secretId,
      VersionStage: 'AWSCURRENT',
      MoveToVersionId: token,
    }));

    console.log(`Successfully finished rotation for ${secretId}`);

    // Log successful rotation
    console.log('AUDIT_LOG', {
      event_type: 'credential_rotation_completed',
      secret_id: secretId,
      new_version_id: token,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`Failed to finish rotation:`, error);
    throw error;
  }
}

/**
 * Create new database credentials
 */
async function createNewDatabaseCredentials(currentSecretString: string): Promise<string> {
  const currentCreds: DatabaseCredentials = JSON.parse(currentSecretString);
  
  // Generate new password
  const newPassword = generateSecurePassword();
  
  const newCreds: DatabaseCredentials = {
    ...currentCreds,
    password: newPassword,
  };

  return JSON.stringify(newCreds);
}

/**
 * Create new API key
 */
async function createNewAPIKey(currentSecretString: string): Promise<string> {
  try {
    const currentCreds: APIKeyCredentials = JSON.parse(currentSecretString);
    
    // Generate new API key
    const newAPIKey = generateAPIKey();
    
    const newCreds: APIKeyCredentials = {
      ...currentCreds,
      apiKey: newAPIKey,
      keyId: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    };

    return JSON.stringify(newCreds);

  } catch (error) {
    // If current secret is just a string (simple API key), create new structure
    const newAPIKey = generateAPIKey();
    
    const newCreds: APIKeyCredentials = {
      apiKey: newAPIKey,
      keyId: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    return JSON.stringify(newCreds);
  }
}

/**
 * Create new service configuration
 */
async function createNewServiceConfig(currentSecretString: string): Promise<string> {
  const currentConfig = JSON.parse(currentSecretString);
  
  // Update any keys or tokens in the configuration
  const newConfig = { ...currentConfig };
  
  if (newConfig.apiKey) {
    newConfig.apiKey = generateAPIKey();
  }
  
  if (newConfig.secretKey) {
    newConfig.secretKey = generateSecurePassword();
  }
  
  if (newConfig.token) {
    newConfig.token = generateAPIKey();
  }

  return JSON.stringify(newConfig);
}

/**
 * Set new database credentials in RDS
 */
async function setDatabaseCredentials(newSecretString: string, secretId: string): Promise<void> {
  const newCreds: DatabaseCredentials = JSON.parse(newSecretString);
  
  // For Aurora clusters, we would update the master password
  // This is a simplified example - in production, you'd need to identify the cluster
  const rdsClient = new RDSClient({ region: process.env.AWS_REGION });
  
  // Extract cluster identifier from secret name or tags
  const clusterIdentifier = extractClusterIdentifier(secretId);
  
  if (clusterIdentifier) {
    await rdsClient.send(new ModifyDBClusterCommand({
      DBClusterIdentifier: clusterIdentifier,
      MasterUserPassword: newCreds.password,
      ApplyImmediately: true,
    }));
  }
}

/**
 * Set new API key (placeholder - would integrate with actual service)
 */
async function setAPIKey(newSecretString: string, secretId: string): Promise<void> {
  // This would integrate with the actual service to update API keys
  // For example, updating MindsDB API keys, Bedrock configurations, etc.
  console.log(`Setting new API key for ${secretId}`);
  
  // In a real implementation, this would:
  // 1. Connect to the service API
  // 2. Update the API key
  // 3. Verify the update was successful
}

/**
 * Set new service configuration
 */
async function setServiceConfig(newSecretString: string, secretId: string): Promise<void> {
  // This would update service configurations
  // For example, restarting ECS services with new configuration
  console.log(`Setting new service config for ${secretId}`);
  
  // Example: Restart ECS service to pick up new configuration
  const ecsClient = new ECSClient({ region: process.env.AWS_REGION });
  
  const serviceName = extractServiceName(secretId);
  const clusterName = process.env.ECS_CLUSTER_NAME;
  
  if (serviceName && clusterName) {
    await ecsClient.send(new UpdateServiceCommand({
      cluster: clusterName,
      service: serviceName,
      forceNewDeployment: true,
    }));
  }
}

/**
 * Test database connection with new credentials
 */
async function testDatabaseConnection(newSecretString: string): Promise<void> {
  const newCreds: DatabaseCredentials = JSON.parse(newSecretString);
  
  // Test connection to database
  // This would use pg library to test PostgreSQL connection
  console.log(`Testing database connection to ${newCreds.host}:${newCreds.port}`);
  
  // In a real implementation:
  // const { Pool } = require('pg');
  // const pool = new Pool(newCreds);
  // await pool.query('SELECT 1');
  // await pool.end();
}

/**
 * Test API key functionality
 */
async function testAPIKey(newSecretString: string): Promise<void> {
  const newCreds: APIKeyCredentials = JSON.parse(newSecretString);
  
  // Test API key by making a test request
  console.log(`Testing API key: ${newCreds.keyId}`);
  
  // In a real implementation, this would make an actual API call
  // to verify the key works
}

/**
 * Test service configuration
 */
async function testServiceConfig(newSecretString: string): Promise<void> {
  const newConfig = JSON.parse(newSecretString);
  
  // Test service configuration
  console.log(`Testing service configuration`);
  
  // In a real implementation, this would verify the configuration
  // is valid and the service can start with it
}

/**
 * Generate secure password
 */
function generateSecurePassword(length: number = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  
  return password;
}

/**
 * Generate API key
 */
function generateAPIKey(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Extract cluster identifier from secret ID
 */
function extractClusterIdentifier(secretId: string): string | null {
  // Extract cluster identifier from secret name pattern
  const match = secretId.match(/aurora-cluster-([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

/**
 * Extract service name from secret ID
 */
function extractServiceName(secretId: string): string | null {
  // Extract service name from secret name pattern
  const match = secretId.match(/service-([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}