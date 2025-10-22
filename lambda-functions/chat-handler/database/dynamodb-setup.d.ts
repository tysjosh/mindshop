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
export declare class DynamoDBSetup {
    private client;
    constructor(region?: string);
    /**
     * Create sessions table with proper indexes and TTL
     */
    createSessionsTable(tableConfig: DynamoDBTableConfig): Promise<void>;
    /**
     * Enable TTL on a table
     */
    private enableTTL;
    /**
     * Wait for table to become active
     */
    private waitForTableActive;
    /**
     * Setup all required DynamoDB tables
     */
    setupAllTables(): Promise<void>;
    /**
     * Cleanup tables (for testing/development)
     */
    cleanupTables(tableNames: string[]): Promise<void>;
}
/**
 * Initialize DynamoDB tables
 */
export declare function initializeDynamoDB(): Promise<void>;
//# sourceMappingURL=dynamodb-setup.d.ts.map