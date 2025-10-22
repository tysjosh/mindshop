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
exports.DynamoDBSetup = void 0;
exports.initializeDynamoDB = initializeDynamoDB;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const config_1 = require("../config");
/**
 * DynamoDB Table Setup for Session Management
 */
class DynamoDBSetup {
    constructor(region = config_1.config.aws.region) {
        this.client = new client_dynamodb_1.DynamoDBClient({ region });
    }
    /**
     * Create sessions table with proper indexes and TTL
     */
    async createSessionsTable(tableConfig) {
        const { tableName, billingMode = 'PAY_PER_REQUEST' } = tableConfig;
        try {
            // Check if table already exists
            try {
                await this.client.send(new client_dynamodb_1.DescribeTableCommand({ TableName: tableName }));
                console.log(`✅ DynamoDB table ${tableName} already exists`);
                return;
            }
            catch (error) {
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
                        KeyType: 'HASH', // Partition key
                    },
                    {
                        AttributeName: 'session_id',
                        KeyType: 'RANGE', // Sort key
                    },
                ],
                AttributeDefinitions: [
                    {
                        AttributeName: 'merchant_id',
                        AttributeType: 'S',
                    },
                    {
                        AttributeName: 'session_id',
                        AttributeType: 'S',
                    },
                    {
                        AttributeName: 'user_id',
                        AttributeType: 'S',
                    },
                    {
                        AttributeName: 'created_at',
                        AttributeType: 'S',
                    },
                ],
                GlobalSecondaryIndexes: [
                    {
                        IndexName: 'UserIdIndex',
                        KeySchema: [
                            {
                                AttributeName: 'user_id',
                                KeyType: 'HASH',
                            },
                            {
                                AttributeName: 'created_at',
                                KeyType: 'RANGE',
                            },
                        ],
                        Projection: {
                            ProjectionType: 'ALL',
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
                                KeyType: 'HASH',
                            },
                            {
                                AttributeName: 'created_at',
                                KeyType: 'RANGE',
                            },
                        ],
                        Projection: {
                            ProjectionType: 'ALL',
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
                    StreamViewType: 'NEW_AND_OLD_IMAGES',
                },
                Tags: [
                    {
                        Key: 'Environment',
                        Value: config_1.config.nodeEnv,
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
            await this.client.send(new client_dynamodb_1.CreateTableCommand(createTableParams));
            // Wait for table to be active
            await this.waitForTableActive(tableName);
            // Enable TTL on the table
            await this.enableTTL(tableName, 'ttl');
            console.log(`✅ DynamoDB table ${tableName} created successfully`);
        }
        catch (error) {
            console.error(`❌ Failed to create DynamoDB table ${tableName}:`, error);
            throw error;
        }
    }
    /**
     * Enable TTL on a table
     */
    async enableTTL(tableName, ttlAttributeName) {
        try {
            await this.client.send(new client_dynamodb_1.UpdateTimeToLiveCommand({
                TableName: tableName,
                TimeToLiveSpecification: {
                    AttributeName: ttlAttributeName,
                    Enabled: true,
                },
            }));
            console.log(`✅ TTL enabled on ${tableName} with attribute ${ttlAttributeName}`);
        }
        catch (error) {
            console.error(`❌ Failed to enable TTL on ${tableName}:`, error);
            throw error;
        }
    }
    /**
     * Wait for table to become active
     */
    async waitForTableActive(tableName, maxWaitTime = 300000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const result = await this.client.send(new client_dynamodb_1.DescribeTableCommand({ TableName: tableName }));
                if (result.Table?.TableStatus === 'ACTIVE') {
                    return;
                }
                console.log(`⏳ Waiting for table ${tableName} to become active... (${result.Table?.TableStatus})`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            }
            catch (error) {
                console.error(`Error checking table status:`, error);
                throw error;
            }
        }
        throw new Error(`Table ${tableName} did not become active within ${maxWaitTime}ms`);
    }
    /**
     * Setup all required DynamoDB tables
     */
    async setupAllTables() {
        console.log('🚀 Setting up DynamoDB tables for MindsDB RAG Assistant...');
        // Sessions table
        await this.createSessionsTable({
            tableName: process.env.SESSION_TABLE_NAME || 'mindsdb-rag-sessions-dev',
            region: config_1.config.aws.region,
            billingMode: 'PAY_PER_REQUEST',
        });
        console.log('✅ All DynamoDB tables setup completed');
    }
    /**
     * Cleanup tables (for testing/development)
     */
    async cleanupTables(tableNames) {
        console.log('🧹 Cleaning up DynamoDB tables...');
        for (const tableName of tableNames) {
            try {
                const { DeleteTableCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-dynamodb')));
                await this.client.send(new DeleteTableCommand({ TableName: tableName }));
                console.log(`🗑️  Deleted table: ${tableName}`);
            }
            catch (error) {
                if (error.name === 'ResourceNotFoundException') {
                    console.log(`ℹ️  Table ${tableName} does not exist`);
                }
                else {
                    console.error(`❌ Failed to delete table ${tableName}:`, error);
                }
            }
        }
    }
}
exports.DynamoDBSetup = DynamoDBSetup;
/**
 * Initialize DynamoDB tables
 */
async function initializeDynamoDB() {
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
//# sourceMappingURL=dynamodb-setup.js.map