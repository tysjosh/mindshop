"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantIsolatedClient = exports.TenantIsolatedConnection = void 0;
exports.createTenantIsolatedConnection = createTenantIsolatedConnection;
exports.injectTenantDB = injectTenantDB;
const tenantIsolation_1 = require("../api/middleware/tenantIsolation");
const EncryptionService_1 = require("../services/EncryptionService");
/**
 * Database connection wrapper that enforces tenant isolation
 */
class TenantIsolatedConnection {
    constructor(pool) {
        this.queryInterceptor = (0, tenantIsolation_1.getQueryInterceptor)();
        this.encryptionService = (0, EncryptionService_1.getEncryptionService)();
        this.queryMetrics = [];
        this.pool = pool;
    }
    /**
     * Execute a query with automatic tenant isolation
     */
    async query(text, params = [], options) {
        const startTime = Date.now();
        const queryId = this.generateQueryId();
        try {
            // Validate tenant context
            this.validateTenantContext(options.tenantContext);
            // Intercept and modify query for tenant isolation
            const { modifiedQuery, parameters, warnings } = this.queryInterceptor.interceptQuery(text, options.tenantContext, options.allowedTables);
            // Merge parameters
            const finalParams = [...params];
            if (parameters.merchant_id && !options.allowCrossTenant) {
                finalParams.push(parameters.merchant_id);
            }
            // Log query for audit
            this.logQueryExecution(queryId, modifiedQuery, options.tenantContext, warnings);
            // Execute the query
            const result = await this.pool.query(modifiedQuery, finalParams);
            // Calculate metrics
            const executionTime = Date.now() - startTime;
            const metrics = {
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
                const encryptedRows = await this.encryptQueryResults(result.rows, options.tenantContext.merchantId);
                result.rows = encryptedRows;
            }
            return { ...result, metrics };
        }
        catch (error) {
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
    async transaction(callback, options) {
        const client = await this.pool.connect();
        const tenantClient = new TenantIsolatedClient(client, options.tenantContext);
        try {
            await client.query("BEGIN");
            const result = await callback(tenantClient);
            await client.query("COMMIT");
            return result;
        }
        catch (error) {
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
        }
        finally {
            client.release();
        }
    }
    /**
     * Get connection pool status
     */
    getPoolStatus() {
        return {
            totalConnections: this.pool.totalCount,
            idleConnections: this.pool.idleCount,
            waitingClients: this.pool.waitingCount,
        };
    }
    /**
     * Get query metrics for monitoring
     */
    getQueryMetrics(merchantId) {
        if (merchantId) {
            return this.queryMetrics.filter((m) => m.merchantId === merchantId);
        }
        return [...this.queryMetrics];
    }
    /**
     * Validate tenant context
     */
    validateTenantContext(tenantContext) {
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
    generateQueryId() {
        return `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    /**
     * Get query type from SQL text
     */
    getQueryType(query) {
        const normalizedQuery = query.trim().toUpperCase();
        if (normalizedQuery.startsWith("SELECT"))
            return "SELECT";
        if (normalizedQuery.startsWith("INSERT"))
            return "INSERT";
        if (normalizedQuery.startsWith("UPDATE"))
            return "UPDATE";
        if (normalizedQuery.startsWith("DELETE"))
            return "DELETE";
        if (normalizedQuery.startsWith("WITH"))
            return "CTE";
        return "OTHER";
    }
    /**
     * Extract table names from SQL query (simple regex approach)
     */
    extractTableNames(query) {
        const tables = [];
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
    logQueryExecution(queryId, query, tenantContext, warnings) {
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
    async encryptQueryResults(rows, merchantId) {
        const sensitiveFields = [
            "email",
            "phone",
            "address",
            "payment_token",
            "card_number",
        ];
        return Promise.all(rows.map(async (row) => {
            const encryptedRow = { ...row };
            for (const [key, value] of Object.entries(row)) {
                if (sensitiveFields.some((field) => key.toLowerCase().includes(field)) &&
                    typeof value === "string" &&
                    value.length > 0) {
                    try {
                        encryptedRow[key] = await this.encryptionService.encryptString(value, merchantId, "query_result", "result_encryption");
                    }
                    catch (error) {
                        console.error(`Failed to encrypt field ${key}:`, error);
                        encryptedRow[key] = "[ENCRYPTED_ERROR]";
                    }
                }
            }
            return encryptedRow;
        }));
    }
    /**
     * Clean up old metrics to prevent memory leaks
     */
    cleanupOldMetrics() {
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
exports.TenantIsolatedConnection = TenantIsolatedConnection;
/**
 * Tenant-isolated database client for transactions
 */
class TenantIsolatedClient {
    constructor(client, tenantContext) {
        this.queryInterceptor = (0, tenantIsolation_1.getQueryInterceptor)();
        this.client = client;
        this.tenantContext = tenantContext;
    }
    /**
     * Execute query with tenant isolation in transaction context
     */
    async query(text, params = [], options = {}) {
        // Intercept and modify query
        const { modifiedQuery, parameters, warnings } = this.queryInterceptor.interceptQuery(text, this.tenantContext, options.allowedTables);
        // Merge parameters
        const finalParams = [...params];
        if (parameters.merchant_id && !options.allowCrossTenant) {
            finalParams.push(parameters.merchant_id);
        }
        // Log warnings if any
        if (warnings.length > 0) {
            console.warn("Query interception warnings:", warnings);
        }
        return this.client.query(modifiedQuery, finalParams);
    }
    /**
     * Release the client back to the pool
     */
    release() {
        this.client.release();
    }
}
exports.TenantIsolatedClient = TenantIsolatedClient;
/**
 * Factory function to create tenant-isolated connection
 */
function createTenantIsolatedConnection(pool) {
    return new TenantIsolatedConnection(pool);
}
/**
 * Middleware to inject tenant-isolated database connection
 */
function injectTenantDB(connection) {
    return (req, res, next) => {
        req.tenantDB = connection;
        next();
    };
}
//# sourceMappingURL=tenantIsolatedConnection.js.map