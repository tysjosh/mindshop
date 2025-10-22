import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import {
  TenantContext,
  getQueryInterceptor,
} from "../api/middleware/tenantIsolation";
import { getEncryptionService } from "../services/EncryptionService";

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
export class TenantIsolatedConnection {
  private pool: Pool;
  private queryInterceptor = getQueryInterceptor();
  private encryptionService = getEncryptionService();
  private queryMetrics: QueryMetrics[] = [];

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Execute a query with automatic tenant isolation
   */
  public async query<T extends QueryResultRow = any>(
    text: string,
    params: any[] = [],
    options: TenantIsolatedQueryOptions
  ): Promise<QueryResult<T> & { metrics: QueryMetrics }> {
    const startTime = Date.now();
    const queryId = this.generateQueryId();

    try {
      // Validate tenant context
      this.validateTenantContext(options.tenantContext);

      // Intercept and modify query for tenant isolation
      const { modifiedQuery, parameters, warnings } =
        this.queryInterceptor.interceptQuery(
          text,
          options.tenantContext,
          options.allowedTables
        );

      // Merge parameters
      const finalParams = [...params];
      if (parameters.merchant_id && !options.allowCrossTenant) {
        finalParams.push(parameters.merchant_id);
      }

      // Log query for audit
      this.logQueryExecution(
        queryId,
        modifiedQuery,
        options.tenantContext,
        warnings
      );

      // Execute the query
      const result = await this.pool.query<T>(modifiedQuery, finalParams);

      // Calculate metrics
      const executionTime = Date.now() - startTime;
      const metrics: QueryMetrics = {
        queryId,
        merchantId: options.tenantContext.merchantId,
        queryType: this.getQueryType(text),
        executionTimeMs: executionTime,
        rowsAffected: result.rowCount || 0,
        tablesAccessed: this.extractTableNames(text),
        tenantIsolationApplied: warnings.length === 0,
        warnings,
      };

      // Store metrics for monitoring
      this.queryMetrics.push(metrics);
      this.cleanupOldMetrics();

      // Encrypt results if requested
      if (options.encryptResults && result.rows.length > 0) {
        const encryptedRows = await this.encryptQueryResults(
          result.rows,
          options.tenantContext.merchantId
        );
        result.rows = encryptedRows as T[];
      }

      return { ...result, metrics };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Log error for security monitoring
      console.log("SECURITY_EVENT", {
        event_type: "database_query_error",
        query_id: queryId,
        merchant_id: options.tenantContext.merchantId,
        user_role: options.tenantContext.userRole,
        query_type: this.getQueryType(text),
        execution_time_ms: executionTime,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Execute a transaction with tenant isolation
   */
  public async transaction<T>(
    callback: (client: TenantIsolatedClient) => Promise<T>,
    options: TenantIsolatedQueryOptions
  ): Promise<T> {
    const client = await this.pool.connect();
    const tenantClient = new TenantIsolatedClient(
      client,
      options.tenantContext
    );

    try {
      await client.query("BEGIN");
      const result = await callback(tenantClient);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");

      // Log transaction failure
      console.log("AUDIT_LOG", {
        event_type: "transaction_rollback",
        merchant_id: options.tenantContext.merchantId,
        user_role: options.tenantContext.userRole,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get connection pool status
   */
  public getPoolStatus(): {
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  } {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
    };
  }

  /**
   * Get query metrics for monitoring
   */
  public getQueryMetrics(merchantId?: string): QueryMetrics[] {
    if (merchantId) {
      return this.queryMetrics.filter((m) => m.merchantId === merchantId);
    }
    return [...this.queryMetrics];
  }

  /**
   * Validate tenant context
   */
  private validateTenantContext(tenantContext: TenantContext): void {
    if (!tenantContext.merchantId) {
      throw new Error("Merchant ID is required for tenant isolation");
    }

    if (!tenantContext.userRole) {
      throw new Error("User role is required for tenant isolation");
    }

    // Validate merchant ID format
    const merchantIdRegex = /^[a-zA-Z0-9-]{3,50}$/;
    if (!merchantIdRegex.test(tenantContext.merchantId)) {
      throw new Error("Invalid merchant ID format");
    }
  }

  /**
   * Generate unique query ID for tracking
   */
  private generateQueryId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get query type from SQL text
   */
  private getQueryType(query: string): string {
    const normalizedQuery = query.trim().toUpperCase();

    if (normalizedQuery.startsWith("SELECT")) return "SELECT";
    if (normalizedQuery.startsWith("INSERT")) return "INSERT";
    if (normalizedQuery.startsWith("UPDATE")) return "UPDATE";
    if (normalizedQuery.startsWith("DELETE")) return "DELETE";
    if (normalizedQuery.startsWith("WITH")) return "CTE";

    return "OTHER";
  }

  /**
   * Extract table names from SQL query (simple regex approach)
   */
  private extractTableNames(query: string): string[] {
    const tables: string[] = [];

    // Simple regex to find table names after FROM, JOIN, INTO, UPDATE
    const tableRegex = /(?:FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    let match;

    while ((match = tableRegex.exec(query)) !== null) {
      const tableName = match[1].toLowerCase();
      if (!tables.includes(tableName)) {
        tables.push(tableName);
      }
    }

    return tables;
  }

  /**
   * Log query execution for audit
   */
  private logQueryExecution(
    queryId: string,
    query: string,
    tenantContext: TenantContext,
    warnings: string[]
  ): void {
    console.log("AUDIT_LOG", {
      event_type: "database_query_execution",
      query_id: queryId,
      merchant_id: tenantContext.merchantId,
      user_role: tenantContext.userRole,
      isolation_level: tenantContext.isolationLevel,
      query_type: this.getQueryType(query),
      tables_accessed: this.extractTableNames(query),
      tenant_isolation_warnings: warnings,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Encrypt query results for sensitive data
   */
  private async encryptQueryResults(
    rows: any[],
    merchantId: string
  ): Promise<any[]> {
    const sensitiveFields = [
      "email",
      "phone",
      "address",
      "payment_token",
      "card_number",
    ];

    return Promise.all(
      rows.map(async (row) => {
        const encryptedRow = { ...row };

        for (const [key, value] of Object.entries(row)) {
          if (
            sensitiveFields.some((field) =>
              key.toLowerCase().includes(field)
            ) &&
            typeof value === "string" &&
            value.length > 0
          ) {
            try {
              encryptedRow[key] = await this.encryptionService.encryptString(
                value,
                merchantId,
                "query_result",
                "result_encryption"
              );
            } catch (error) {
              console.error(`Failed to encrypt field ${key}:`, error);
              encryptedRow[key] = "[ENCRYPTED_ERROR]";
            }
          }
        }

        return encryptedRow;
      })
    );
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const maxMetrics = 1000;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    this.queryMetrics = this.queryMetrics
      .filter((metric) => {
        const age = now - new Date(metric.queryId.split("_")[1]).getTime();
        return age < maxAge;
      })
      .slice(-maxMetrics);
  }
}

/**
 * Tenant-isolated database client for transactions
 */
export class TenantIsolatedClient {
  private client: PoolClient;
  private tenantContext: TenantContext;
  private queryInterceptor = getQueryInterceptor();

  constructor(client: PoolClient, tenantContext: TenantContext) {
    this.client = client;
    this.tenantContext = tenantContext;
  }

  /**
   * Execute query with tenant isolation in transaction context
   */
  public async query<T extends QueryResultRow = any>(
    text: string,
    params: any[] = [],
    options: { allowCrossTenant?: boolean; allowedTables?: string[] } = {}
  ): Promise<QueryResult<T>> {
    // Intercept and modify query
    const { modifiedQuery, parameters, warnings } =
      this.queryInterceptor.interceptQuery(
        text,
        this.tenantContext,
        options.allowedTables
      );

    // Merge parameters
    const finalParams = [...params];
    if (parameters.merchant_id && !options.allowCrossTenant) {
      finalParams.push(parameters.merchant_id);
    }

    // Log warnings if any
    if (warnings.length > 0) {
      console.warn("Query interception warnings:", warnings);
    }

    return this.client.query<T>(modifiedQuery, finalParams);
  }

  /**
   * Release the client back to the pool
   */
  public release(): void {
    this.client.release();
  }
}

/**
 * Factory function to create tenant-isolated connection
 */
export function createTenantIsolatedConnection(
  pool: Pool
): TenantIsolatedConnection {
  return new TenantIsolatedConnection(pool);
}

/**
 * Middleware to inject tenant-isolated database connection
 */
export function injectTenantDB(connection: TenantIsolatedConnection) {
  return (req: any, res: any, next: any) => {
    req.tenantDB = connection;
    next();
  };
}
