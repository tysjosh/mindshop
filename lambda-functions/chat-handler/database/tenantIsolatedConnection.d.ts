import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { TenantContext } from "../api/middleware/tenantIsolation";
export interface TenantIsolatedQueryOptions {
    tenantContext: TenantContext;
    allowCrossTenant?: boolean;
    allowedTables?: string[];
    encryptResults?: boolean;
}
export interface QueryMetrics {
    queryId: string;
    merchantId: string;
    queryType: string;
    executionTimeMs: number;
    rowsAffected: number;
    tablesAccessed: string[];
    tenantIsolationApplied: boolean;
    warnings: string[];
}
/**
 * Database connection wrapper that enforces tenant isolation
 */
export declare class TenantIsolatedConnection {
    private pool;
    private queryInterceptor;
    private encryptionService;
    private queryMetrics;
    constructor(pool: Pool);
    /**
     * Execute a query with automatic tenant isolation
     */
    query<T extends QueryResultRow = any>(text: string, params: any[] | undefined, options: TenantIsolatedQueryOptions): Promise<QueryResult<T> & {
        metrics: QueryMetrics;
    }>;
    /**
     * Execute a transaction with tenant isolation
     */
    transaction<T>(callback: (client: TenantIsolatedClient) => Promise<T>, options: TenantIsolatedQueryOptions): Promise<T>;
    /**
     * Get connection pool status
     */
    getPoolStatus(): {
        totalConnections: number;
        idleConnections: number;
        waitingClients: number;
    };
    /**
     * Get query metrics for monitoring
     */
    getQueryMetrics(merchantId?: string): QueryMetrics[];
    /**
     * Validate tenant context
     */
    private validateTenantContext;
    /**
     * Generate unique query ID for tracking
     */
    private generateQueryId;
    /**
     * Get query type from SQL text
     */
    private getQueryType;
    /**
     * Extract table names from SQL query (simple regex approach)
     */
    private extractTableNames;
    /**
     * Log query execution for audit
     */
    private logQueryExecution;
    /**
     * Encrypt query results for sensitive data
     */
    private encryptQueryResults;
    /**
     * Clean up old metrics to prevent memory leaks
     */
    private cleanupOldMetrics;
}
/**
 * Tenant-isolated database client for transactions
 */
export declare class TenantIsolatedClient {
    private client;
    private tenantContext;
    private queryInterceptor;
    constructor(client: PoolClient, tenantContext: TenantContext);
    /**
     * Execute query with tenant isolation in transaction context
     */
    query<T extends QueryResultRow = any>(text: string, params?: any[], options?: {
        allowCrossTenant?: boolean;
        allowedTables?: string[];
    }): Promise<QueryResult<T>>;
    /**
     * Release the client back to the pool
     */
    release(): void;
}
/**
 * Factory function to create tenant-isolated connection
 */
export declare function createTenantIsolatedConnection(pool: Pool): TenantIsolatedConnection;
/**
 * Middleware to inject tenant-isolated database connection
 */
export declare function injectTenantDB(connection: TenantIsolatedConnection): (req: any, res: any, next: any) => void;
//# sourceMappingURL=tenantIsolatedConnection.d.ts.map