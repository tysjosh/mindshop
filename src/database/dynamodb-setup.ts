import { DynamoDBClient, CreateTableCommand, DescribeTableCommand, UpdateTimeToLiveCommand } from '@aws-sdk/client-dynamodb';
import { config } from '../config';

export interface DynamoDBTableConfig {
  tableName: string;
  region: string;
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED';
  readCapacityUnits?: number;
  writeCapacityUnits?: number;
}

/**
 * DynamoDB Table Setup for Session Management
 */
export class DynamoDBSetup {
  private client: DynamoDBClient;

  constructor(region: string = config.aws.region) {
    this.client = new DynamoDBClient({ region });
  }

  /**
   * Create sessions table with proper indexes and TTL
   */
  async createSessionsTable(tableConfig: DynamoDBTableConfig): Promise<void> {
    const { tableName, billingMode = 'PAY_PER_REQUEST' } = tableConfig;

    try {
      // Check if table already exists
      try {
        await this.client.send(new DescribeTableCommand({ TableName: tableName }));
        console.log(`✅ DynamoDB table ${tableName} already exists`);
        return;
      } catch (error: any) {
        if (error.name !== 'ResourceNotFoundException') {
          throw error;
        }
      }

      console.log(`🔄 Creating DynamoDB table: ${tableName}`);

      const createTableParams = {
        TableName: tableName,
        KeySchema: [
          {
            AttributeName: 'merchant_id',
            KeyType: 'HASH' as const, // Partition key
          },
          {
            AttributeName: 'session_id',
            KeyType: 'RANGE' as const, // Sort key
          },
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'merchant_id',
            AttributeType: 'S' as const,
          },
          {
            AttributeName: 'session_id',
            AttributeType: 'S' as const,
          },
          {
            AttributeName: 'user_id',
            AttributeType: 'S' as const,
          },
          {
            AttributeName: 'created_at',
            AttributeType: 'S' as const,
          },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'UserIdIndex',
            KeySchema: [
              {
                AttributeName: 'user_id',
                KeyType: 'HASH' as const,
              },
              {
                AttributeName: 'created_at',
                KeyType: 'RANGE' as const,
              },
            ],
            Projection: {
              ProjectionType: 'ALL' as const,
            },
            ...(billingMode === 'PROVISIONED' && {
              ProvisionedThroughput: {
                ReadCapacityUnits: tableConfig.readCapacityUnits || 5,
                WriteCapacityUnits: tableConfig.writeCapacityUnits || 5,
              },
            }),
          },
          {
            IndexName: 'MerchantCreatedIndex',
            KeySchema: [
              {
                AttributeName: 'merchant_id',
                KeyType: 'HASH' as const,
              },
              {
                AttributeName: 'created_at',
                KeyType: 'RANGE' as const,
              },
            ],
            Projection: {
              ProjectionType: 'ALL' as const,
            },
            ...(billingMode === 'PROVISIONED' && {
              ProvisionedThroughput: {
                ReadCapacityUnits: tableConfig.readCapacityUnits || 5,
                WriteCapacityUnits: tableConfig.writeCapacityUnits || 5,
              },
            }),
          },
        ],
        BillingMode: billingMode,
        ...(billingMode === 'PROVISIONED' && {
          ProvisionedThroughput: {
            ReadCapacityUnits: tableConfig.readCapacityUnits || 10,
            WriteCapacityUnits: tableConfig.writeCapacityUnits || 10,
          },
        }),
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: 'NEW_AND_OLD_IMAGES' as const,
        },
        Tags: [
          {
            Key: 'Environment',
            Value: config.nodeEnv,
          },
          {
            Key: 'Service',
            Value: 'MindsDB-RAG-Assistant',
          },
          {
            Key: 'Component',
            Value: 'SessionManagement',
          },
        ],
      };

      await this.client.send(new CreateTableCommand(createTableParams));

      // Wait for table to be active
      await this.waitForTableActive(tableName);

      // Enable TTL on the table
      await this.enableTTL(tableName, 'ttl');

      console.log(`✅ DynamoDB table ${tableName} created successfully`);

    } catch (error) {
      console.error(`❌ Failed to create DynamoDB table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Enable TTL on a table
   */
  private async enableTTL(tableName: string, ttlAttributeName: string): Promise<void> {
    try {
      await this.client.send(new UpdateTimeToLiveCommand({
        TableName: tableName,
        TimeToLiveSpecification: {
          AttributeName: ttlAttributeName,
          Enabled: true,
        },
      }));

      console.log(`✅ TTL enabled on ${tableName} with attribute ${ttlAttributeName}`);
    } catch (error) {
      console.error(`❌ Failed to enable TTL on ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Wait for table to become active
   */
  private async waitForTableActive(tableName: string, maxWaitTime: number = 300000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const result = await this.client.send(new DescribeTableCommand({ TableName: tableName }));
        
        if (result.Table?.TableStatus === 'ACTIVE') {
          return;
        }

        console.log(`⏳ Waiting for table ${tableName} to become active... (${result.Table?.TableStatus})`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
      } catch (error) {
        console.error(`Error checking table status:`, error);
        throw error;
      }
    }

    throw new Error(`Table ${tableName} did not become active within ${maxWaitTime}ms`);
  }

  /**
   * Setup all required DynamoDB tables
   */
  async setupAllTables(): Promise<void> {
    console.log('🚀 Setting up DynamoDB tables for MindsDB RAG Assistant...');

    // Sessions table
    await this.createSessionsTable({
      tableName: process.env.SESSION_TABLE_NAME || 'mindsdb-rag-sessions-dev',
      region: config.aws.region,
      billingMode: 'PAY_PER_REQUEST',
    });

    console.log('✅ All DynamoDB tables setup completed');
  }

  /**
   * Cleanup tables (for testing/development)
   */
  async cleanupTables(tableNames: string[]): Promise<void> {
    console.log('🧹 Cleaning up DynamoDB tables...');

    for (const tableName of tableNames) {
      try {
        const { DeleteTableCommand } = await import('@aws-sdk/client-dynamodb');
        await this.client.send(new DeleteTableCommand({ TableName: tableName }));
        console.log(`🗑️  Deleted table: ${tableName}`);
      } catch (error: any) {
        if (error.name === 'ResourceNotFoundException') {
          console.log(`ℹ️  Table ${tableName} does not exist`);
        } else {
          console.error(`❌ Failed to delete table ${tableName}:`, error);
        }
      }
    }
  }
}

/**
 * Initialize DynamoDB tables
 */
export async function initializeDynamoDB(): Promise<void> {
  const setup = new DynamoDBSetup();
  await setup.setupAllTables();
}

/**
 * CLI script for table management
 */
if (require.main === module) {
  const command = process.argv[2];
  const setup = new DynamoDBSetup();

  switch (command) {
    case 'setup':
      setup.setupAllTables()
        .then(() => {
          console.log('✅ Setup completed');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Setup failed:', error);
          process.exit(1);
        });
      break;

    case 'cleanup':
      const tablesToCleanup = [
        process.env.SESSION_TABLE_NAME || 'mindsdb-rag-sessions-dev',
      ];
      setup.cleanupTables(tablesToCleanup)
        .then(() => {
          console.log('✅ Cleanup completed');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Cleanup failed:', error);
          process.exit(1);
        });
      break;

    default:
      console.log('Usage: ts-node src/database/dynamodb-setup.ts [setup|cleanup]');
      process.exit(1);
  }
}