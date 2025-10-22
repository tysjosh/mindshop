import { Request, Response, NextFunction } from "express";
import { CognitoAuthenticatedRequest } from "./cognitoAuth";

export interface TenantContext {
  merchantId: string;
  userRole: string;
  permissions: string[];
  isolationLevel: "strict" | "standard" | "relaxed";
}

export interface TenantIsolatedRequest extends CognitoAuthenticatedRequest {
  tenantContext?: TenantContext;
  merchantId?: string;
  userRole?: string;
  permissions?: string[];
}

/**
 * Middleware to enforce tenant isolation at the application level
 */
export const tenantIsolationMiddleware = (
  req: TenantIsolatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.merchantId) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required for tenant isolation",
        code: "TENANT_AUTH_REQUIRED",
      });
      return;
    }

    // Determine isolation level based on user role
    let isolationLevel: "strict" | "standard" | "relaxed" = "strict";

    switch (req.userRole) {
      case "platform_admin":
        isolationLevel = "relaxed"; // Can access multiple tenants
        break;
      case "merchant_admin":
        isolationLevel = "standard"; // Can access own tenant data
        break;
      case "customer":
      default:
        isolationLevel = "strict"; // Strict isolation
        break;
    }

    // Create tenant context
    const tenantContext: TenantContext = {
      merchantId: req.merchantId,
      userRole: req.userRole || "customer",
      permissions: req.permissions || [],
      isolationLevel,
    };

    // Attach tenant context to request
    req.tenantContext = tenantContext;

    // Validate tenant access for the requested resource
    const requestedMerchantId = extractMerchantIdFromRequest(req as any);

    if (
      requestedMerchantId &&
      !canAccessMerchant(tenantContext, requestedMerchantId)
    ) {
      // Log security violation
      console.log("SECURITY_EVENT", {
        event_type: "tenant_isolation_violation",
        user_id: req.user.userId,
        user_merchant_id: req.merchantId,
        requested_merchant_id: requestedMerchantId,
        user_role: req.userRole,
        endpoint: req.path,
        method: req.method,
        ip_address: req.ip,
        timestamp: new Date().toISOString(),
      });

      res.status(403).json({
        error: "Forbidden",
        message: "Access denied: tenant isolation violation",
        code: "TENANT_ISOLATION_VIOLATION",
      });
      return;
    }

    // Add tenant isolation headers for downstream services
    res.setHeader("X-Tenant-Id", tenantContext.merchantId);
    res.setHeader("X-Isolation-Level", tenantContext.isolationLevel);

    next();
  } catch (error) {
    console.error("Tenant isolation middleware error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Tenant isolation check failed",
      code: "TENANT_ISOLATION_ERROR",
    });
  }
};

/**
 * Extract merchant ID from various parts of the request
 */
function extractMerchantIdFromRequest(req: Request): string | null {
  // Check URL parameters
  if (req.params.merchantId) {
    return req.params.merchantId;
  }

  // Check query parameters
  if (req.query.merchantId && typeof req.query.merchantId === "string") {
    return req.query.merchantId;
  }

  // Check request body
  if (req.body && req.body.merchantId) {
    return req.body.merchantId;
  }

  // Check headers
  const headerMerchantId = req.get("X-Merchant-Id");
  if (headerMerchantId) {
    return headerMerchantId;
  }

  return null;
}

/**
 * Check if tenant context allows access to a specific merchant
 */
function canAccessMerchant(
  tenantContext: TenantContext,
  requestedMerchantId: string
): boolean {
  switch (tenantContext.isolationLevel) {
    case "relaxed":
      // Platform admins can access any merchant
      return true;

    case "standard":
      // Merchant admins can access their own merchant
      return tenantContext.merchantId === requestedMerchantId;

    case "strict":
    default:
      // Customers can only access their own merchant
      return tenantContext.merchantId === requestedMerchantId;
  }
}

/**
 * Database query interceptor to automatically add merchant_id filters
 */
export class DatabaseQueryInterceptor {
  private static instance: DatabaseQueryInterceptor;

  private constructor() {}

  public static getInstance(): DatabaseQueryInterceptor {
    if (!DatabaseQueryInterceptor.instance) {
      DatabaseQueryInterceptor.instance = new DatabaseQueryInterceptor();
    }
    return DatabaseQueryInterceptor.instance;
  }

  /**
   * Intercept and modify SQL queries to add tenant isolation
   */
  public interceptQuery(
    originalQuery: string,
    tenantContext: TenantContext,
    allowedTables: string[] = []
  ): {
    modifiedQuery: string;
    parameters: Record<string, any>;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let modifiedQuery = originalQuery.trim();
    const parameters: Record<string, any> = {};

    // Only apply strict filtering for non-platform admins
    if (tenantContext.isolationLevel === "relaxed") {
      return { modifiedQuery, parameters, warnings };
    }

    try {
      // Parse query type
      const queryType = this.getQueryType(modifiedQuery);

      switch (queryType) {
        case "SELECT":
          modifiedQuery = this.addSelectFilter(
            modifiedQuery,
            tenantContext,
            allowedTables
          );
          break;

        case "INSERT":
          modifiedQuery = this.addInsertMerchantId(
            modifiedQuery,
            tenantContext
          );
          break;

        case "UPDATE":
          modifiedQuery = this.addUpdateFilter(
            modifiedQuery,
            tenantContext,
            allowedTables
          );
          break;

        case "DELETE":
          modifiedQuery = this.addDeleteFilter(
            modifiedQuery,
            tenantContext,
            allowedTables
          );
          break;

        default:
          warnings.push(`Unsupported query type: ${queryType}`);
          break;
      }

      parameters.merchant_id = tenantContext.merchantId;
    } catch (error) {
      warnings.push(
        `Query interception failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    return { modifiedQuery, parameters, warnings };
  }

  /**
   * Get the type of SQL query
   */
  private getQueryType(query: string): string {
    const normalizedQuery = query.toUpperCase().trim();

    if (normalizedQuery.startsWith("SELECT")) return "SELECT";
    if (normalizedQuery.startsWith("INSERT")) return "INSERT";
    if (normalizedQuery.startsWith("UPDATE")) return "UPDATE";
    if (normalizedQuery.startsWith("DELETE")) return "DELETE";

    return "UNKNOWN";
  }

  /**
   * Add merchant_id filter to SELECT queries
   */
  private addSelectFilter(
    query: string,
    tenantContext: TenantContext,
    allowedTables: string[]
  ): string {
    // Simple regex-based approach - in production, use a proper SQL parser
    const fromMatch = query.match(/FROM\s+(\w+)/i);

    if (!fromMatch) {
      return query;
    }

    const tableName = fromMatch[1];

    // Check if table requires tenant filtering
    if (this.requiresTenantFiltering(tableName, allowedTables)) {
      // Add WHERE clause or extend existing WHERE clause
      if (query.toUpperCase().includes("WHERE")) {
        // Extend existing WHERE clause
        return query.replace(
          /WHERE/i,
          `WHERE ${tableName}.merchant_id = $merchant_id AND`
        );
      } else {
        // Add new WHERE clause
        const orderByMatch = query.match(/ORDER\s+BY/i);
        const groupByMatch = query.match(/GROUP\s+BY/i);
        const havingMatch = query.match(/HAVING/i);
        const limitMatch = query.match(/LIMIT/i);

        let insertPosition = query.length;

        // Find the right position to insert WHERE clause
        if (orderByMatch)
          insertPosition = Math.min(insertPosition, orderByMatch.index!);
        if (groupByMatch)
          insertPosition = Math.min(insertPosition, groupByMatch.index!);
        if (havingMatch)
          insertPosition = Math.min(insertPosition, havingMatch.index!);
        if (limitMatch)
          insertPosition = Math.min(insertPosition, limitMatch.index!);

        return (
          query.slice(0, insertPosition) +
          ` WHERE ${tableName}.merchant_id = $merchant_id ` +
          query.slice(insertPosition)
        );
      }
    }

    return query;
  }

  /**
   * Add merchant_id to INSERT queries
   */
  private addInsertMerchantId(
    query: string,
    tenantContext: TenantContext
  ): string {
    // Simple approach - in production, use proper SQL parsing
    const insertMatch = query.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);

    if (!insertMatch) {
      return query;
    }

    const tableName = insertMatch[1];
    const columns = insertMatch[2];

    if (this.requiresTenantFiltering(tableName)) {
      // Check if merchant_id is already included
      if (!columns.toLowerCase().includes("merchant_id")) {
        // Add merchant_id to columns and values
        const newColumns = columns + ", merchant_id";
        const valuesMatch = query.match(/VALUES\s*\(([^)]+)\)/i);

        if (valuesMatch) {
          const values = valuesMatch[1];
          const newValues = values + ", $merchant_id";

          return query
            .replace(/\([^)]+\)/, `(${newColumns})`)
            .replace(/VALUES\s*\([^)]+\)/i, `VALUES (${newValues})`);
        }
      }
    }

    return query;
  }

  /**
   * Add merchant_id filter to UPDATE queries
   */
  private addUpdateFilter(
    query: string,
    tenantContext: TenantContext,
    allowedTables: string[]
  ): string {
    const updateMatch = query.match(/UPDATE\s+(\w+)/i);

    if (!updateMatch) {
      return query;
    }

    const tableName = updateMatch[1];

    if (this.requiresTenantFiltering(tableName, allowedTables)) {
      if (query.toUpperCase().includes("WHERE")) {
        return query.replace(
          /WHERE/i,
          `WHERE ${tableName}.merchant_id = $merchant_id AND`
        );
      } else {
        return query + ` WHERE ${tableName}.merchant_id = $merchant_id`;
      }
    }

    return query;
  }

  /**
   * Add merchant_id filter to DELETE queries
   */
  private addDeleteFilter(
    query: string,
    tenantContext: TenantContext,
    allowedTables: string[]
  ): string {
    const deleteMatch = query.match(/DELETE\s+FROM\s+(\w+)/i);

    if (!deleteMatch) {
      return query;
    }

    const tableName = deleteMatch[1];

    if (this.requiresTenantFiltering(tableName, allowedTables)) {
      if (query.toUpperCase().includes("WHERE")) {
        return query.replace(
          /WHERE/i,
          `WHERE ${tableName}.merchant_id = $merchant_id AND`
        );
      } else {
        return query + ` WHERE ${tableName}.merchant_id = $merchant_id`;
      }
    }

    return query;
  }

  /**
   * Check if a table requires tenant filtering
   */
  private requiresTenantFiltering(
    tableName: string,
    allowedTables: string[] = []
  ): boolean {
    // Tables that should always have tenant filtering
    const tenantTables = [
      "documents",
      "user_sessions",
      "audit_logs",
      "transactions",
      "embeddings",
      "predictions",
      "conversations",
      "user_contexts",
    ];

    // System tables that don't require filtering
    const systemTables = [
      "schema_migrations",
      "system_config",
      "health_checks",
    ];

    const lowerTableName = tableName.toLowerCase();

    // Check if explicitly allowed
    if (allowedTables.includes(lowerTableName)) {
      return false;
    }

    // Check if it's a system table
    if (systemTables.includes(lowerTableName)) {
      return false;
    }

    // Check if it's a tenant table
    if (tenantTables.includes(lowerTableName)) {
      return true;
    }

    // Default to requiring filtering for unknown tables
    return true;
  }
}

/**
 * Middleware to validate MindsDB predictor access
 */
export const validateMindsDBAccess = (
  req: TenantIsolatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.tenantContext) {
      res.status(500).json({
        error: "Internal Server Error",
        message: "Tenant context not initialized",
        code: "TENANT_CONTEXT_MISSING",
      });
      return;
    }

    // Extract predictor name from request
    const predictorName =
      req.params.predictor || req.body.predictor || req.query.predictor;

    if (predictorName && typeof predictorName === "string") {
      // Validate predictor access based on tenant context
      if (!canAccessPredictor(req.tenantContext, predictorName)) {
        console.log("SECURITY_EVENT", {
          event_type: "mindsdb_predictor_access_denied",
          user_id: req.user?.userId,
          merchant_id: req.tenantContext.merchantId,
          predictor_name: predictorName,
          user_role: req.tenantContext.userRole,
          timestamp: new Date().toISOString(),
        });

        res.status(403).json({
          error: "Forbidden",
          message: "Access denied to MindsDB predictor",
          code: "PREDICTOR_ACCESS_DENIED",
        });
        return;
      }
    }

    next();
  } catch (error) {
    console.error("MindsDB access validation error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "MindsDB access validation failed",
      code: "MINDSDB_ACCESS_ERROR",
    });
  }
};

/**
 * Check if tenant can access a specific MindsDB predictor
 */
function canAccessPredictor(
  tenantContext: TenantContext,
  predictorName: string
): boolean {
  // Platform admins can access any predictor
  if (tenantContext.isolationLevel === "relaxed") {
    return true;
  }

  // Check if predictor name includes merchant ID for tenant isolation
  const expectedPrefix = `${tenantContext.merchantId}_`;

  if (!predictorName.startsWith(expectedPrefix)) {
    // Allow access to shared/global predictors for certain roles
    const sharedPredictors = ["semantic_retriever", "product_signals"];

    if (
      sharedPredictors.includes(predictorName) &&
      tenantContext.userRole === "merchant_admin"
    ) {
      return true;
    }

    return false;
  }

  return true;
}

/**
 * Get database query interceptor instance
 */
export const getQueryInterceptor = (): DatabaseQueryInterceptor => {
  return DatabaseQueryInterceptor.getInstance();
};
