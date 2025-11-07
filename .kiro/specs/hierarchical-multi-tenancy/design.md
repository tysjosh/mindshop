# Design Document: Hierarchical Multi-Tenancy for MindShop

## Overview

This design document outlines the technical architecture for adding hierarchical multi-tenancy support to MindShop. The solution extends the existing flat multi-tenancy model (independent merchants) with a parent-child relationship model (platform → stores → customers) while maintaining full backward compatibility.

The design follows a dual-mode approach where the system intelligently handles both direct merchants and platform merchants using the same infrastructure, with data isolation enforced at the appropriate level based on account type.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MindShop Platform                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐            │
│  │  Direct Merchant │         │ Platform Merchant │            │
│  │   (Flat Model)   │         │ (Hierarchical)    │            │
│  └────────┬─────────┘         └────────┬─────────┘            │
│           │                             │                       │
│           │ merchant_id                 │ platform_id          │
│           │                             │                       │
│           ▼                             ▼                       │
│  ┌─────────────────┐         ┌──────────────────────┐         │
│  │  Single-Level   │         │   Two-Level          │         │
│  │  Isolation      │         │   Isolation          │         │
│  │  (merchant_id)  │         │   (platform_id +     │         │
│  │                 │         │    store_id)         │         │
│  └─────────────────┘         └──────────┬───────────┘         │
│                                          │                      │
│                              ┌───────────┼───────────┐         │
│                              │           │           │         │
│                              ▼           ▼           ▼         │
│                         ┌────────┐ ┌────────┐ ┌────────┐      │
│                         │Store 1 │ │Store 2 │ │Store N │      │
│                         └────────┘ └────────┘ └────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow for Platform Requests

```
Customer Request → Widget (with platformId + storeId)
                     ↓
                API Gateway
                     ↓
            Auth Middleware
                     ↓
         ┌───────────┴───────────┐
         │                       │
    Validate API Key      Extract Context
         │                       │
         └───────────┬───────────┘
                     ↓
          Set Database Context
          (platform_id, store_id)
                     ↓
              Query Handler
                     ↓
         Two-Level Data Filter
         (WHERE platform_id = X
          AND store_id = Y)
                     ↓
              Response
```

## Components and Interfaces

### 1. Database Schema Extensions


#### Extended Merchants Table

```typescript
// Add to existing merchants table
export const merchants = pgTable("merchants", {
  // ... existing fields ...
  accountType: pgEnum("account_type", ["direct", "platform"])
    .notNull()
    .default("direct"),
  parentMerchantId: text("parent_merchant_id")
    .references(() => merchants.merchantId, { onDelete: "cascade" }),
});
```

#### New Stores Table

```typescript
export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    storeId: text("store_id").notNull(),
    platformId: text("platform_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    storeName: text("store_name").notNull(),
    storeOwnerId: text("store_owner_id"),
    storeUrl: text("store_url"),
    settings: jsonb("settings").default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    platformStoreIdx: index("idx_stores_platform_store").on(
      table.platformId,
      table.storeId
    ),
    platformIdx: index("idx_stores_platform").on(table.platformId),
    statusIdx: index("idx_stores_status").on(table.status),
    uniquePlatformStore: unique("unique_platform_store").on(
      table.platformId,
      table.storeId
    ),
  })
);
```

#### Extended Data Tables

All existing data tables need platform/store context fields:

```typescript
// Documents table extension
export const documents = pgTable("documents", {
  // ... existing fields ...
  platformId: text("platform_id"), // NULL for direct merchants
  storeId: text("store_id"),       // NULL for direct merchants
});

// User sessions table extension
export const userSessions = pgTable("user_sessions", {
  // ... existing fields ...
  platformId: text("platform_id"),
  storeId: text("store_id"),
});

// Audit logs table extension
export const auditLogs = pgTable("audit_logs", {
  // ... existing fields ...
  platformId: text("platform_id"),
  storeId: text("store_id"),
});

// Cost tracking table extension
export const costTracking = pgTable("cost_tracking", {
  // ... existing fields ...
  platformId: text("platform_id"),
  storeId: text("store_id"),
});

// Transactions table extension
export const transactions = pgTable("transactions", {
  // ... existing fields ...
  platformId: text("platform_id"),
  storeId: text("store_id"),
});
```

### 2. Authentication & Authorization Layer

#### Enhanced Auth Middleware

```typescript
// src/api/middleware/auth.ts

export interface AuthContext {
  accountType: "direct" | "platform";
  merchantId: string;
  platformId?: string;
  storeId?: string;
  apiKey: ApiKey;
}

export const authenticateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract API key
    const apiKey = extractApiKey(req);
    
    // Validate and get merchant
    const merchant = await validateApiKey(apiKey);
    
    if (merchant.accountType === "direct") {
      // Direct merchant - single-level isolation
      req.authContext = {
        accountType: "direct",
        merchantId: merchant.merchantId,
        apiKey: apiKey,
      };
      
      // Set database context for RLS
      await setDatabaseContext({
        merchantId: merchant.merchantId,
      });
    } else {
      // Platform merchant - two-level isolation
      const { platformId, storeId } = req.body;
      
      // Validate platform context
      if (!platformId || !storeId) {
        throw new Error("platformId and storeId required for platform accounts");
      }
      
      // Verify platform matches API key
      if (platformId !== merchant.merchantId) {
        throw new Error("Platform ID mismatch");
      }
      
      // Verify store exists and belongs to platform
      const store = await getStore(platformId, storeId);
      if (!store) {
        throw new Error("Store not found");
      }
      
      req.authContext = {
        accountType: "platform",
        merchantId: merchant.merchantId,
        platformId: platformId,
        storeId: storeId,
        apiKey: apiKey,
      };
      
      // Set database context for RLS
      await setDatabaseContext({
        platformId: platformId,
        storeId: storeId,
      });
    }
    
    next();
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};
```

#### Database Context Manager

```typescript
// src/services/DatabaseContextManager.ts

export class DatabaseContextManager {
  async setContext(context: {
    merchantId?: string;
    platformId?: string;
    storeId?: string;
  }): Promise<void> {
    const queries: string[] = [];
    
    if (context.merchantId) {
      queries.push(`SET LOCAL app.current_merchant_id = '${context.merchantId}'`);
    }
    
    if (context.platformId) {
      queries.push(`SET LOCAL app.current_platform_id = '${context.platformId}'`);
    }
    
    if (context.storeId) {
      queries.push(`SET LOCAL app.current_store_id = '${context.storeId}'`);
    }
    
    for (const query of queries) {
      await db.execute(sql.raw(query));
    }
  }
  
  async clearContext(): Promise<void> {
    await db.execute(sql`RESET app.current_merchant_id`);
    await db.execute(sql`RESET app.current_platform_id`);
    await db.execute(sql`RESET app.current_store_id`);
  }
}
```

### 3. Repository Layer Updates

#### Base Repository with Dual-Mode Support

```typescript
// src/repositories/BaseRepository.ts

export abstract class BaseRepository<T> {
  protected buildWhereClause(authContext: AuthContext): SQL {
    if (authContext.accountType === "direct") {
      // Single-level isolation
      return sql`merchant_id = ${authContext.merchantId}`;
    } else {
      // Two-level isolation
      return sql`
        platform_id = ${authContext.platformId} 
        AND store_id = ${authContext.storeId}
      `;
    }
  }
  
  protected async query(
    authContext: AuthContext,
    additionalWhere?: SQL
  ): Promise<T[]> {
    const baseWhere = this.buildWhereClause(authContext);
    const where = additionalWhere 
      ? sql`${baseWhere} AND ${additionalWhere}`
      : baseWhere;
    
    return await db.select().from(this.table).where(where);
  }
}
```

#### Document Repository

```typescript
// src/repositories/DocumentRepository.ts

export class DocumentRepository extends BaseRepository<Document> {
  async create(
    authContext: AuthContext,
    document: NewDocument
  ): Promise<Document> {
    const docData = {
      ...document,
      merchantId: authContext.merchantId,
      platformId: authContext.platformId || null,
      storeId: authContext.storeId || null,
    };
    
    const [created] = await db
      .insert(documents)
      .values(docData)
      .returning();
    
    return created;
  }
  
  async findByMerchant(authContext: AuthContext): Promise<Document[]> {
    return await this.query(authContext);
  }
  
  async semanticSearch(
    authContext: AuthContext,
    embedding: number[],
    limit: number = 10
  ): Promise<Document[]> {
    const whereClause = this.buildWhereClause(authContext);
    
    return await db
      .select()
      .from(documents)
      .where(whereClause)
      .orderBy(sql`embedding <-> ${embedding}`)
      .limit(limit);
  }
}
```

### 4. Service Layer Updates

#### Store Management Service

```typescript
// src/services/StoreManagementService.ts

export class StoreManagementService {
  async createStore(
    platformId: string,
    storeData: {
      storeId: string;
      storeName: string;
      storeOwnerId?: string;
      storeUrl?: string;
      settings?: any;
    }
  ): Promise<Store> {
    // Verify platform exists
    const platform = await merchantRepository.findById(platformId);
    if (!platform || platform.accountType !== "platform") {
      throw new Error("Invalid platform");
    }
    
    // Create store
    const [store] = await db
      .insert(stores)
      .values({
        storeId: storeData.storeId,
        platformId: platformId,
        storeName: storeData.storeName,
        storeOwnerId: storeData.storeOwnerId,
        storeUrl: storeData.storeUrl,
        settings: storeData.settings || {},
        status: "active",
      })
      .returning();
    
    return store;
  }
  
  async bulkCreateStores(
    platformId: string,
    storesData: Array<{
      storeId: string;
      storeName: string;
      storeOwnerId?: string;
      storeUrl?: string;
    }>
  ): Promise<{ success: Store[]; errors: any[] }> {
    const success: Store[] = [];
    const errors: any[] = [];
    
    for (const storeData of storesData) {
      try {
        const store = await this.createStore(platformId, storeData);
        success.push(store);
      } catch (error) {
        errors.push({
          storeId: storeData.storeId,
          error: error.message,
        });
      }
    }
    
    return { success, errors };
  }
  
  async getStore(
    platformId: string,
    storeId: string
  ): Promise<Store | null> {
    const [store] = await db
      .select()
      .from(stores)
      .where(
        and(
          eq(stores.platformId, platformId),
          eq(stores.storeId, storeId)
        )
      )
      .limit(1);
    
    return store || null;
  }
  
  async listStores(
    platformId: string,
    filters?: { status?: string }
  ): Promise<Store[]> {
    let query = db
      .select()
      .from(stores)
      .where(eq(stores.platformId, platformId));
    
    if (filters?.status) {
      query = query.where(eq(stores.status, filters.status));
    }
    
    return await query;
  }
  
  async updateStore(
    platformId: string,
    storeId: string,
    updates: Partial<Store>
  ): Promise<Store> {
    const [updated] = await db
      .update(stores)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stores.platformId, platformId),
          eq(stores.storeId, storeId)
        )
      )
      .returning();
    
    return updated;
  }
  
  async deactivateStore(
    platformId: string,
    storeId: string
  ): Promise<void> {
    await this.updateStore(platformId, storeId, { status: "inactive" });
  }
}
```


#### Platform Analytics Service

```typescript
// src/services/PlatformAnalyticsService.ts

export class PlatformAnalyticsService {
  async getPlatformOverview(platformId: string): Promise<{
    totalStores: number;
    activeStores: number;
    totalConversations: number;
    totalQueries: number;
  }> {
    const [storeStats] = await db
      .select({
        total: count(),
        active: sql<number>`COUNT(*) FILTER (WHERE status = 'active')`,
      })
      .from(stores)
      .where(eq(stores.platformId, platformId));
    
    const [sessionStats] = await db
      .select({
        conversations: count(),
      })
      .from(userSessions)
      .where(eq(userSessions.platformId, platformId));
    
    const [costStats] = await db
      .select({
        queries: count(),
      })
      .from(costTracking)
      .where(
        and(
          eq(costTracking.platformId, platformId),
          eq(costTracking.operation, "retrieval")
        )
      );
    
    return {
      totalStores: storeStats.total,
      activeStores: storeStats.active,
      totalConversations: sessionStats.conversations,
      totalQueries: costStats.queries,
    };
  }
  
  async getTopPerformingStores(
    platformId: string,
    limit: number = 10
  ): Promise<Array<{
    storeId: string;
    storeName: string;
    queries: number;
    conversions: number;
    conversionRate: number;
  }>> {
    const results = await db
      .select({
        storeId: stores.storeId,
        storeName: stores.storeName,
        queries: count(costTracking.id),
        conversions: sql<number>`
          COUNT(*) FILTER (
            WHERE ${transactions.status} = 'completed'
          )
        `,
      })
      .from(stores)
      .leftJoin(
        costTracking,
        and(
          eq(costTracking.platformId, stores.platformId),
          eq(costTracking.storeId, stores.storeId)
        )
      )
      .leftJoin(
        transactions,
        and(
          eq(transactions.platformId, stores.platformId),
          eq(transactions.storeId, stores.storeId)
        )
      )
      .where(eq(stores.platformId, platformId))
      .groupBy(stores.storeId, stores.storeName)
      .orderBy(desc(count(costTracking.id)))
      .limit(limit);
    
    return results.map((r) => ({
      ...r,
      conversionRate: r.queries > 0 ? (r.conversions / r.queries) * 100 : 0,
    }));
  }
  
  async getStoreAnalytics(
    platformId: string,
    storeId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<{
    queries: number;
    conversations: number;
    conversions: number;
    revenue: number;
    avgResponseTime: number;
  }> {
    const [queryStats] = await db
      .select({
        queries: count(),
        avgResponseTime: avg(costTracking.computeMs),
      })
      .from(costTracking)
      .where(
        and(
          eq(costTracking.platformId, platformId),
          eq(costTracking.storeId, storeId),
          gte(costTracking.timestamp, dateRange.start),
          lte(costTracking.timestamp, dateRange.end)
        )
      );
    
    const [sessionStats] = await db
      .select({
        conversations: count(),
      })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.platformId, platformId),
          eq(userSessions.storeId, storeId),
          gte(userSessions.createdAt, dateRange.start),
          lte(userSessions.createdAt, dateRange.end)
        )
      );
    
    const [transactionStats] = await db
      .select({
        conversions: count(),
        revenue: sum(transactions.totalAmount),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.platformId, platformId),
          eq(transactions.storeId, storeId),
          eq(transactions.status, "completed"),
          gte(transactions.createdAt, dateRange.start),
          lte(transactions.createdAt, dateRange.end)
        )
      );
    
    return {
      queries: queryStats.queries,
      conversations: sessionStats.conversations,
      conversions: transactionStats.conversions,
      revenue: transactionStats.revenue || 0,
      avgResponseTime: queryStats.avgResponseTime || 0,
    };
  }
}
```

### 5. API Routes

#### Platform Management Routes

```typescript
// src/api/routes/platforms.ts

import { Router } from "express";
import { authenticateRequest } from "../middleware/auth";
import { PlatformController } from "../controllers/PlatformController";

const router = Router();
const controller = new PlatformController();

// Store management
router.post(
  "/platforms/:platformId/stores",
  authenticateRequest,
  controller.createStore
);

router.post(
  "/platforms/:platformId/stores/bulk",
  authenticateRequest,
  controller.bulkCreateStores
);

router.get(
  "/platforms/:platformId/stores",
  authenticateRequest,
  controller.listStores
);

router.get(
  "/platforms/:platformId/stores/:storeId",
  authenticateRequest,
  controller.getStore
);

router.put(
  "/platforms/:platformId/stores/:storeId",
  authenticateRequest,
  controller.updateStore
);

router.delete(
  "/platforms/:platformId/stores/:storeId",
  authenticateRequest,
  controller.deactivateStore
);

// Analytics
router.get(
  "/platforms/:platformId/analytics",
  authenticateRequest,
  controller.getPlatformAnalytics
);

router.get(
  "/platforms/:platformId/analytics/stores/:storeId",
  authenticateRequest,
  controller.getStoreAnalytics
);

// Document management for stores
router.post(
  "/platforms/:platformId/stores/:storeId/documents",
  authenticateRequest,
  controller.uploadStoreDocuments
);

router.get(
  "/platforms/:platformId/stores/:storeId/documents",
  authenticateRequest,
  controller.getStoreDocuments
);

export default router;
```

#### Platform Controller

```typescript
// src/api/controllers/PlatformController.ts

export class PlatformController {
  private storeService = new StoreManagementService();
  private analyticsService = new PlatformAnalyticsService();
  private documentService = new DocumentService();
  
  async createStore(req: Request, res: Response): Promise<void> {
    try {
      const { platformId } = req.params;
      const { authContext } = req;
      
      // Verify platform ownership
      if (authContext.merchantId !== platformId) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }
      
      const store = await this.storeService.createStore(
        platformId,
        req.body
      );
      
      res.status(201).json(store);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  
  async bulkCreateStores(req: Request, res: Response): Promise<void> {
    try {
      const { platformId } = req.params;
      const { authContext } = req;
      
      if (authContext.merchantId !== platformId) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }
      
      const { stores } = req.body;
      const result = await this.storeService.bulkCreateStores(
        platformId,
        stores
      );
      
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  
  async listStores(req: Request, res: Response): Promise<void> {
    try {
      const { platformId } = req.params;
      const { authContext } = req;
      
      if (authContext.merchantId !== platformId) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }
      
      const stores = await this.storeService.listStores(
        platformId,
        req.query
      );
      
      res.status(200).json(stores);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  
  async getPlatformAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { platformId } = req.params;
      const { authContext } = req;
      
      if (authContext.merchantId !== platformId) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }
      
      const overview = await this.analyticsService.getPlatformOverview(
        platformId
      );
      const topStores = await this.analyticsService.getTopPerformingStores(
        platformId
      );
      
      res.status(200).json({
        overview,
        topStores,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  
  async uploadStoreDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { platformId, storeId } = req.params;
      const { authContext } = req;
      
      if (authContext.merchantId !== platformId) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }
      
      // Set store context for document upload
      const storeContext: AuthContext = {
        accountType: "platform",
        merchantId: platformId,
        platformId: platformId,
        storeId: storeId,
        apiKey: authContext.apiKey,
      };
      
      const documents = await this.documentService.bulkUpload(
        storeContext,
        req.body.documents
      );
      
      res.status(201).json(documents);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}
```

### 6. Widget Updates

#### Enhanced Widget Configuration

```typescript
// widget/src/types.ts

export interface WidgetConfig {
  apiKey: string;
  apiBaseUrl?: string;
  
  // For direct merchants
  merchantId?: string;
  
  // For platform merchants
  platformId?: string;
  storeId?: string;
  storeName?: string;
  
  // Appearance
  theme?: {
    primaryColor?: string;
    fontFamily?: string;
  };
  
  // Behavior
  behavior?: {
    greeting?: string;
    placeholder?: string;
  };
}
```

#### Widget Initialization

```typescript
// widget/src/MindShopWidget.ts

export class MindShopWidget {
  private config: WidgetConfig;
  private apiClient: ApiClient;
  private sessionId: string;
  
  constructor(config: WidgetConfig) {
    this.validateConfig(config);
    this.config = config;
    
    // Initialize API client with appropriate context
    this.apiClient = new ApiClient({
      apiKey: config.apiKey,
      baseUrl: config.apiBaseUrl,
      merchantId: config.merchantId,
      platformId: config.platformId,
      storeId: config.storeId,
    });
    
    this.init();
  }
  
  private validateConfig(config: WidgetConfig): void {
    if (!config.apiKey) {
      throw new Error("apiKey is required");
    }
    
    // Check if platform key
    const isPlatformKey = config.apiKey.startsWith("pk_platform_");
    
    if (isPlatformKey) {
      // Platform keys require platformId and storeId
      if (!config.platformId || !config.storeId) {
        throw new Error(
          "platformId and storeId are required for platform API keys"
        );
      }
    } else {
      // Direct merchant keys can optionally specify merchantId
      // (will be derived from API key if not provided)
    }
  }
  
  async sendMessage(query: string): Promise<void> {
    const payload: any = {
      query,
      sessionId: this.sessionId,
    };
    
    // Add platform context if applicable
    if (this.config.platformId && this.config.storeId) {
      payload.platformId = this.config.platformId;
      payload.storeId = this.config.storeId;
    }
    
    const response = await this.apiClient.chat(payload);
    this.displayResponse(response);
  }
}
```

#### API Client

```typescript
// widget/src/ApiClient.ts

export class ApiClient {
  private apiKey: string;
  private baseUrl: string;
  private merchantId?: string;
  private platformId?: string;
  private storeId?: string;
  
  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    merchantId?: string;
    platformId?: string;
    storeId?: string;
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.mindshop.ai";
    this.merchantId = config.merchantId;
    this.platformId = config.platformId;
    this.storeId = config.storeId;
  }
  
  async chat(payload: {
    query: string;
    sessionId: string;
    platformId?: string;
    storeId?: string;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    return await response.json();
  }
}
```


## Data Models

### Account Type Enum

```typescript
export enum AccountType {
  DIRECT = "direct",
  PLATFORM = "platform",
}
```

### Store Model

```typescript
export interface Store {
  id: string;
  storeId: string;
  platformId: string;
  storeName: string;
  storeOwnerId?: string;
  storeUrl?: string;
  settings: {
    theme?: {
      primaryColor?: string;
      fontFamily?: string;
    };
    features?: {
      chatEnabled?: boolean;
      checkoutEnabled?: boolean;
    };
    customization?: Record<string, any>;
  };
  status: "active" | "inactive" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}
```

### Platform Analytics Model

```typescript
export interface PlatformAnalytics {
  overview: {
    totalStores: number;
    activeStores: number;
    totalConversations: number;
    totalQueries: number;
  };
  topStores: Array<{
    storeId: string;
    storeName: string;
    queries: number;
    conversions: number;
    conversionRate: number;
  }>;
  costBreakdown: Array<{
    storeId: string;
    storeName: string;
    totalCost: number;
    queryCost: number;
    predictionCost: number;
  }>;
}
```

### Store Analytics Model

```typescript
export interface StoreAnalytics {
  storeId: string;
  storeName: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  metrics: {
    queries: number;
    conversations: number;
    conversions: number;
    revenue: number;
    avgResponseTime: number;
    avgSessionDuration: number;
  };
  trends: {
    queriesOverTime: Array<{ date: string; count: number }>;
    conversionsOverTime: Array<{ date: string; count: number }>;
  };
}
```

## Error Handling

### Platform-Specific Errors

```typescript
// src/errors/PlatformErrors.ts

export class PlatformNotFoundError extends Error {
  constructor(platformId: string) {
    super(`Platform not found: ${platformId}`);
    this.name = "PlatformNotFoundError";
  }
}

export class StoreNotFoundError extends Error {
  constructor(platformId: string, storeId: string) {
    super(`Store not found: ${storeId} in platform ${platformId}`);
    this.name = "StoreNotFoundError";
  }
}

export class PlatformMismatchError extends Error {
  constructor() {
    super("Platform ID in request does not match API key");
    this.name = "PlatformMismatchError";
  }
}

export class InvalidAccountTypeError extends Error {
  constructor(expected: string, actual: string) {
    super(`Invalid account type. Expected: ${expected}, Got: ${actual}`);
    this.name = "InvalidAccountTypeError";
  }
}

export class StoreAlreadyExistsError extends Error {
  constructor(platformId: string, storeId: string) {
    super(`Store ${storeId} already exists in platform ${platformId}`);
    this.name = "StoreAlreadyExistsError";
  }
}
```

### Error Handler Middleware

```typescript
// src/api/middleware/errorHandler.ts

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof PlatformNotFoundError) {
    return res.status(404).json({
      error: "Platform not found",
      message: error.message,
    });
  }
  
  if (error instanceof StoreNotFoundError) {
    return res.status(404).json({
      error: "Store not found",
      message: error.message,
    });
  }
  
  if (error instanceof PlatformMismatchError) {
    return res.status(403).json({
      error: "Platform mismatch",
      message: error.message,
    });
  }
  
  if (error instanceof InvalidAccountTypeError) {
    return res.status(400).json({
      error: "Invalid account type",
      message: error.message,
    });
  }
  
  if (error instanceof StoreAlreadyExistsError) {
    return res.status(409).json({
      error: "Store already exists",
      message: error.message,
    });
  }
  
  // Default error
  return res.status(500).json({
    error: "Internal server error",
    message: error.message,
  });
};
```

## Testing Strategy

### Unit Tests

#### Repository Tests

```typescript
// src/repositories/__tests__/DocumentRepository.test.ts

describe("DocumentRepository - Hierarchical Multi-Tenancy", () => {
  describe("Direct Merchant", () => {
    it("should create document with merchant_id only", async () => {
      const authContext: AuthContext = {
        accountType: "direct",
        merchantId: "merchant-123",
        apiKey: mockApiKey,
      };
      
      const doc = await documentRepo.create(authContext, {
        title: "Test Product",
        body: "Description",
        documentType: "product",
      });
      
      expect(doc.merchantId).toBe("merchant-123");
      expect(doc.platformId).toBeNull();
      expect(doc.storeId).toBeNull();
    });
    
    it("should only retrieve documents for merchant", async () => {
      const authContext: AuthContext = {
        accountType: "direct",
        merchantId: "merchant-123",
        apiKey: mockApiKey,
      };
      
      const docs = await documentRepo.findByMerchant(authContext);
      
      expect(docs.every(d => d.merchantId === "merchant-123")).toBe(true);
    });
  });
  
  describe("Platform Merchant", () => {
    it("should create document with platform_id and store_id", async () => {
      const authContext: AuthContext = {
        accountType: "platform",
        merchantId: "platform-doordash",
        platformId: "platform-doordash",
        storeId: "joes-pizza-123",
        apiKey: mockApiKey,
      };
      
      const doc = await documentRepo.create(authContext, {
        title: "Margherita Pizza",
        body: "Classic pizza",
        documentType: "product",
      });
      
      expect(doc.merchantId).toBe("platform-doordash");
      expect(doc.platformId).toBe("platform-doordash");
      expect(doc.storeId).toBe("joes-pizza-123");
    });
    
    it("should only retrieve documents for specific store", async () => {
      const authContext: AuthContext = {
        accountType: "platform",
        merchantId: "platform-doordash",
        platformId: "platform-doordash",
        storeId: "joes-pizza-123",
        apiKey: mockApiKey,
      };
      
      const docs = await documentRepo.findByMerchant(authContext);
      
      expect(docs.every(d => 
        d.platformId === "platform-doordash" &&
        d.storeId === "joes-pizza-123"
      )).toBe(true);
    });
    
    it("should not retrieve documents from other stores", async () => {
      // Create docs for two different stores
      await createTestDocuments("platform-doordash", "joes-pizza-123");
      await createTestDocuments("platform-doordash", "sushi-palace-456");
      
      const authContext: AuthContext = {
        accountType: "platform",
        merchantId: "platform-doordash",
        platformId: "platform-doordash",
        storeId: "joes-pizza-123",
        apiKey: mockApiKey,
      };
      
      const docs = await documentRepo.findByMerchant(authContext);
      
      expect(docs.every(d => d.storeId === "joes-pizza-123")).toBe(true);
      expect(docs.some(d => d.storeId === "sushi-palace-456")).toBe(false);
    });
  });
});
```

#### Service Tests

```typescript
// src/services/__tests__/StoreManagementService.test.ts

describe("StoreManagementService", () => {
  let service: StoreManagementService;
  
  beforeEach(() => {
    service = new StoreManagementService();
  });
  
  describe("createStore", () => {
    it("should create store for valid platform", async () => {
      const store = await service.createStore("platform-doordash", {
        storeId: "joes-pizza-123",
        storeName: "Joe's Pizza",
        storeUrl: "https://doordash.com/store/joes-pizza",
      });
      
      expect(store.storeId).toBe("joes-pizza-123");
      expect(store.platformId).toBe("platform-doordash");
      expect(store.status).toBe("active");
    });
    
    it("should throw error for invalid platform", async () => {
      await expect(
        service.createStore("invalid-platform", {
          storeId: "test-store",
          storeName: "Test Store",
        })
      ).rejects.toThrow("Invalid platform");
    });
    
    it("should throw error for duplicate store", async () => {
      await service.createStore("platform-doordash", {
        storeId: "joes-pizza-123",
        storeName: "Joe's Pizza",
      });
      
      await expect(
        service.createStore("platform-doordash", {
          storeId: "joes-pizza-123",
          storeName: "Joe's Pizza Duplicate",
        })
      ).rejects.toThrow("Store already exists");
    });
  });
  
  describe("bulkCreateStores", () => {
    it("should create multiple stores", async () => {
      const result = await service.bulkCreateStores("platform-doordash", [
        { storeId: "store-1", storeName: "Store 1" },
        { storeId: "store-2", storeName: "Store 2" },
        { storeId: "store-3", storeName: "Store 3" },
      ]);
      
      expect(result.success).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should handle partial failures", async () => {
      // Create one store first
      await service.createStore("platform-doordash", {
        storeId: "store-1",
        storeName: "Store 1",
      });
      
      const result = await service.bulkCreateStores("platform-doordash", [
        { storeId: "store-1", storeName: "Store 1 Duplicate" }, // Will fail
        { storeId: "store-2", storeName: "Store 2" }, // Will succeed
        { storeId: "store-3", storeName: "Store 3" }, // Will succeed
      ]);
      
      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].storeId).toBe("store-1");
    });
  });
});
```

### Integration Tests

```typescript
// src/tests/integration/hierarchicalMultiTenancy.test.ts

describe("Hierarchical Multi-Tenancy Integration", () => {
  describe("Platform Store Isolation", () => {
    it("should isolate data between stores on same platform", async () => {
      // Setup: Create platform and two stores
      const platform = await createTestPlatform("doordash");
      const store1 = await createTestStore(platform.id, "joes-pizza");
      const store2 = await createTestStore(platform.id, "sushi-palace");
      
      // Upload documents to store 1
      await uploadDocuments(platform.id, store1.storeId, [
        { title: "Margherita Pizza", body: "Classic pizza" },
      ]);
      
      // Upload documents to store 2
      await uploadDocuments(platform.id, store2.storeId, [
        { title: "California Roll", body: "Sushi roll" },
      ]);
      
      // Query store 1 - should only see pizza
      const store1Docs = await queryDocuments(platform.id, store1.storeId);
      expect(store1Docs).toHaveLength(1);
      expect(store1Docs[0].title).toBe("Margherita Pizza");
      
      // Query store 2 - should only see sushi
      const store2Docs = await queryDocuments(platform.id, store2.storeId);
      expect(store2Docs).toHaveLength(1);
      expect(store2Docs[0].title).toBe("California Roll");
    });
    
    it("should isolate sessions between stores", async () => {
      const platform = await createTestPlatform("doordash");
      const store1 = await createTestStore(platform.id, "joes-pizza");
      const store2 = await createTestStore(platform.id, "sushi-palace");
      
      // Create session for store 1
      const session1 = await createSession(platform.id, store1.storeId);
      
      // Try to access session from store 2 - should fail
      await expect(
        getSession(platform.id, store2.storeId, session1.sessionId)
      ).rejects.toThrow("Session not found");
    });
  });
  
  describe("Backward Compatibility", () => {
    it("should maintain direct merchant functionality", async () => {
      // Create direct merchant
      const merchant = await createTestMerchant("acme-corp", "direct");
      
      // Upload documents
      await uploadDocumentsForDirectMerchant(merchant.merchantId, [
        { title: "Product 1", body: "Description" },
      ]);
      
      // Query documents
      const docs = await queryDocumentsForDirectMerchant(merchant.merchantId);
      expect(docs).toHaveLength(1);
      expect(docs[0].platformId).toBeNull();
      expect(docs[0].storeId).toBeNull();
    });
  });
});
```

### End-to-End Tests

```typescript
// widget/tests/e2e/platformIntegration.test.ts

describe("Platform Widget Integration E2E", () => {
  it("should initialize widget with platform context", async () => {
    const widget = new MindShopWidget({
      apiKey: "pk_platform_test_123",
      platformId: "doordash",
      storeId: "joes-pizza-123",
      storeName: "Joe's Pizza",
    });
    
    expect(widget).toBeDefined();
  });
  
  it("should send chat request with platform context", async () => {
    const widget = new MindShopWidget({
      apiKey: "pk_platform_test_123",
      platformId: "doordash",
      storeId: "joes-pizza-123",
    });
    
    const response = await widget.sendMessage("Show me vegetarian pizzas");
    
    expect(response).toBeDefined();
    expect(response.recommendations).toBeDefined();
    // Verify recommendations are from Joe's Pizza only
  });
});
```

## Migration Strategy

### Phase 1: Schema Migration

```sql
-- migrations/002_add_hierarchical_multi_tenancy.sql

-- Add account_type to merchants table
ALTER TABLE merchants 
ADD COLUMN account_type VARCHAR(50) DEFAULT 'direct' NOT NULL,
ADD COLUMN parent_merchant_id TEXT REFERENCES merchants(merchant_id) ON DELETE CASCADE;

CREATE INDEX idx_merchants_account_type ON merchants(account_type);

-- Create stores table
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL,
  platform_id TEXT NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  store_owner_id TEXT,
  store_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(platform_id, store_id)
);

CREATE INDEX idx_stores_platform_store ON stores(platform_id, store_id);
CREATE INDEX idx_stores_platform ON stores(platform_id);
CREATE INDEX idx_stores_status ON stores(status);

-- Add platform/store context to documents
ALTER TABLE documents
ADD COLUMN platform_id TEXT,
ADD COLUMN store_id TEXT;

CREATE INDEX idx_documents_platform_store ON documents(platform_id, store_id);

-- Add platform/store context to user_sessions
ALTER TABLE user_sessions
ADD COLUMN platform_id TEXT,
ADD COLUMN store_id TEXT;

CREATE INDEX idx_sessions_platform_store ON user_sessions(platform_id, store_id);

-- Add platform/store context to audit_logs
ALTER TABLE audit_logs
ADD COLUMN platform_id TEXT,
ADD COLUMN store_id TEXT;

CREATE INDEX idx_audit_platform_store ON audit_logs(platform_id, store_id);

-- Add platform/store context to cost_tracking
ALTER TABLE cost_tracking
ADD COLUMN platform_id TEXT,
ADD COLUMN store_id TEXT;

CREATE INDEX idx_cost_platform_store ON cost_tracking(platform_id, store_id);

-- Add platform/store context to transactions
ALTER TABLE transactions
ADD COLUMN platform_id TEXT,
ADD COLUMN store_id TEXT;

CREATE INDEX idx_transactions_platform_store ON transactions(platform_id, store_id);
```

### Phase 2: Data Migration

All existing merchants default to `account_type = 'direct'` and have NULL values for `platform_id` and `store_id` in all data tables. No data migration needed.

### Phase 3: Code Deployment

1. Deploy database migrations
2. Deploy updated backend code with dual-mode support
3. Deploy updated widget with platform context support
4. Update API documentation

### Phase 4: Testing & Validation

1. Verify existing direct merchants continue to work
2. Test platform merchant creation
3. Test store creation and management
4. Test data isolation between stores
5. Test widget with platform context

## Performance Considerations

### Database Indexing

- Composite indexes on `(platform_id, store_id)` for all data tables
- Separate indexes on `platform_id` for platform-level queries
- Maintain existing `merchant_id` indexes for direct merchants

### Query Optimization

```typescript
// Optimized query for platform store documents
const docs = await db
  .select()
  .from(documents)
  .where(
    and(
      eq(documents.platformId, platformId),
      eq(documents.storeId, storeId)
    )
  )
  .orderBy(desc(documents.createdAt))
  .limit(100);

// Use prepared statements for frequently executed queries
const getPlatformStoreDocuments = db
  .select()
  .from(documents)
  .where(
    and(
      eq(documents.platformId, sql.placeholder('platformId')),
      eq(documents.storeId, sql.placeholder('storeId'))
    )
  )
  .prepare();
```

### Caching Strategy

```typescript
// Cache store metadata
const storeCache = new Map<string, Store>();

async function getStoreCached(
  platformId: string,
  storeId: string
): Promise<Store> {
  const cacheKey = `${platformId}:${storeId}`;
  
  if (storeCache.has(cacheKey)) {
    return storeCache.get(cacheKey)!;
  }
  
  const store = await getStore(platformId, storeId);
  storeCache.set(cacheKey, store);
  
  return store;
}
```

## Security Considerations

### API Key Validation

- Platform API keys have prefix `pk_platform_` to distinguish from direct merchant keys
- Validate platform_id in request matches API key owner
- Validate store_id exists and belongs to platform

### Data Access Control

- Enforce two-level isolation at database level using WHERE clauses
- Never trust client-provided platform_id/store_id without validation
- Log all cross-store access attempts

### Rate Limiting

```typescript
// Apply rate limiting per store, not per platform
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each store to 100 requests per windowMs
  keyGenerator: (req) => {
    const { platformId, storeId } = req.authContext;
    return `${platformId}:${storeId}`;
  },
});
```

This design provides a comprehensive, backward-compatible solution for adding hierarchical multi-tenancy to MindShop while maintaining security, performance, and data isolation.
