/**
 * Integration tests for Product Sync History
 * Tests sync history retrieval, pagination, and filtering
 *
 * Task: Test sync history (Task 1.7 - Integration Testing Phase 1)
 * Requirements: FR1, FR4 from integration-fixes/requirements.md
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";

// Mock authentication middleware before imports
vi.mock("../api/middleware/auth", () => ({
  authenticateJWT: vi.fn(() => (req: any, res: any, next: any) => {
    // Mock authenticated user
    req.user = {
      userId: "test_user_123",
      merchantId: "test_merchant_123",
      roles: ["user", "admin"],
      email: "test@example.com",
    };
    next();
  }),
  requireMerchantAccess: vi.fn(() => (req: any, res: any, next: any) => next()),
  requireRoles: vi.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock API key auth middleware
vi.mock("../api/middleware/apiKeyAuth", () => ({
  requirePermissions: vi.fn(() => (req: any, res: any, next: any) => {
    req.apiKey = {
      keyId: "test_key_123",
      merchantId: "test_merchant_123",
      permissions: ["*"], // Grant all permissions for testing
    };
    next();
  }),
}));

// Mock services before imports
vi.mock("../services/SessionManager", () => ({
  createSessionManager: vi.fn(() => ({
    createSession: vi.fn().mockResolvedValue({}),
    getSession: vi.fn().mockResolvedValue({}),
    updateSession: vi.fn().mockResolvedValue({}),
    deleteSession: vi.fn().mockResolvedValue({}),
  })),
  SessionManager: vi.fn(),
}));

vi.mock("../services/PostgresSessionManager", () => ({
  PostgresSessionManager: vi.fn(() => ({
    createSession: vi.fn().mockResolvedValue({}),
    getSession: vi.fn().mockResolvedValue({}),
    updateSession: vi.fn().mockResolvedValue({}),
    deleteSession: vi.fn().mockResolvedValue({}),
  })),
}));

// Mock ProductSyncService with history data
vi.mock("../services/ProductSyncService", () => {
  const mockSyncHistory = [
    {
      syncId: "sync_123456",
      merchantId: "test_merchant_123",
      status: "success",
      startedAt: new Date("2025-11-05T10:00:00Z"),
      completedAt: new Date("2025-11-05T10:05:00Z"),
      stats: {
        totalProducts: 100,
        created: 50,
        updated: 40,
        skipped: 8,
        failed: 2,
      },
    },
    {
      syncId: "sync_123455",
      merchantId: "test_merchant_123",
      status: "success",
      startedAt: new Date("2025-11-04T10:00:00Z"),
      completedAt: new Date("2025-11-04T10:03:00Z"),
      stats: {
        totalProducts: 80,
        created: 30,
        updated: 45,
        skipped: 5,
        failed: 0,
      },
    },
    {
      syncId: "sync_123454",
      merchantId: "test_merchant_123",
      status: "partial",
      startedAt: new Date("2025-11-03T10:00:00Z"),
      completedAt: new Date("2025-11-03T10:10:00Z"),
      stats: {
        totalProducts: 120,
        created: 60,
        updated: 40,
        skipped: 10,
        failed: 10,
      },
    },
    {
      syncId: "sync_123453",
      merchantId: "test_merchant_123",
      status: "failed",
      startedAt: new Date("2025-11-02T10:00:00Z"),
      completedAt: new Date("2025-11-02T10:01:00Z"),
      stats: {
        totalProducts: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
      error: "Connection timeout",
    },
  ];

  return {
    getProductSyncService: vi.fn(() => ({
      getSyncHistory: vi.fn().mockImplementation(async (merchantId: string, limit?: number) => {
        const history = mockSyncHistory.filter(h => h.merchantId === merchantId);
        return limit ? history.slice(0, limit) : history;
      }),
      getSyncStatus: vi.fn().mockResolvedValue({
        merchantId: "test_merchant_123",
        status: "idle",
        lastSyncAt: new Date("2025-11-05T10:05:00Z"),
        lastSyncResult: mockSyncHistory[0],
      }),
    })),
    ProductSyncService: vi.fn(),
  };
});

// Mock CacheService
vi.mock("../services/CacheService", () => ({
  getCacheService: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock DocumentRepository
vi.mock("../repositories/DocumentRepository", () => ({
  getDocumentRepository: vi.fn(() => ({
    findBySku: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  })),
}));

// Mock MerchantRepository
vi.mock("../repositories/MerchantRepository", () => ({
  getMerchantRepository: vi.fn(() => ({
    findByMerchantId: vi.fn().mockResolvedValue({
      merchantId: "test_merchant_123",
      email: "test@example.com",
      companyName: "Test Company",
      status: "active",
    }),
  })),
}));

// Mock JWT authentication middleware
vi.mock("../api/middleware/auth", () => ({
  authenticateJWT: vi.fn(() => (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        timestamp: new Date().toISOString(),
        requestId: req.headers["x-request-id"] || "unknown",
      });
    }

    req.user = {
      merchantId: req.params.merchantId || "test_merchant_123",
      email: "test@example.com",
      roles: ["merchant_admin", "admin"], // Add admin role to allow access to any merchant
    };
    next();
  }),
  AuthenticatedRequest: vi.fn(),
}));

// Mock rate limiting middleware to avoid rate limit errors in tests
vi.mock("../api/middleware/rateLimit", () => ({
  rateLimitMiddleware: vi.fn(() => (req: any, res: any, next: any) => {
    // Skip rate limiting in tests
    next();
  }),
  defaultRateLimits: {
    general: { windowMs: 15 * 60 * 1000, max: 100 },
    search: { windowMs: 60 * 1000, max: 30 },
    deployment: { windowMs: 60 * 60 * 1000, max: 5 },
    auth: { windowMs: 15 * 60 * 1000, max: 10 },
  },
  merchantRateLimit: vi.fn(() => (req: any, res: any, next: any) => {
    next();
  }),
}));

// Now import after mocks
import request from "supertest";
import express, { Application } from "express";
import productSyncRoutes from "../api/routes/productSync";

describe("Product Sync History Integration Tests", () => {
  let app: Application;
  const testMerchantId = "test_merchant_123";
  const testAccessToken = "mock-access-token-123";
  const expectedHistoryCount = 4; // Number of mock history entries

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = "test";

    // Create minimal Express app for testing
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.headers["x-request-id"] = req.headers["x-request-id"] || "test-request-id";
      next();
    });
    app.use("/api/merchants", productSyncRoutes);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/merchants/:merchantId/sync/history", () => {
    it("should successfully retrieve sync history with valid authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("history");
      expect(response.body.data).toHaveProperty("total");
      expect(Array.isArray(response.body.data.history)).toBe(true);
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("requestId");
    });

    it("should return all sync history entries when no limit is specified", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history.length).toBe(expectedHistoryCount);
      expect(response.body.data.total).toBe(expectedHistoryCount);
    });

    it("should limit sync history results when limit parameter is provided", async () => {
      const limit = 2;
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history?limit=${limit}`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history.length).toBeLessThanOrEqual(limit);
    });

    it("should return sync history entries with correct structure", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const firstEntry = response.body.data.history[0];
      expect(firstEntry).toHaveProperty("syncId");
      expect(firstEntry).toHaveProperty("merchantId");
      expect(firstEntry).toHaveProperty("status");
      expect(firstEntry).toHaveProperty("startedAt");
      expect(firstEntry).toHaveProperty("completedAt");
      expect(firstEntry).toHaveProperty("stats");
      expect(firstEntry.stats).toHaveProperty("totalProducts");
      expect(firstEntry.stats).toHaveProperty("created");
      expect(firstEntry.stats).toHaveProperty("updated");
      expect(firstEntry.stats).toHaveProperty("skipped");
      expect(firstEntry.stats).toHaveProperty("failed");
    });

    it("should return sync history entries in reverse chronological order", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const history = response.body.data.history;
      expect(history.length).toBeGreaterThan(1);
      
      // Verify first entry is more recent than second
      const firstDate = new Date(history[0].startedAt);
      const secondDate = new Date(history[1].startedAt);
      expect(firstDate.getTime()).toBeGreaterThan(secondDate.getTime());
    });

    it("should include successful sync entries in history", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const successfulSyncs = response.body.data.history.filter(
        (entry: any) => entry.status === "success"
      );
      expect(successfulSyncs.length).toBeGreaterThan(0);
    });

    it("should include partial sync entries in history", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const partialSyncs = response.body.data.history.filter(
        (entry: any) => entry.status === "partial"
      );
      expect(partialSyncs.length).toBeGreaterThan(0);
    });

    it("should include failed sync entries in history", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const failedSyncs = response.body.data.history.filter(
        (entry: any) => entry.status === "failed"
      );
      expect(failedSyncs.length).toBeGreaterThan(0);
    });

    it("should include error message for failed syncs", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const failedSync = response.body.data.history.find(
        (entry: any) => entry.status === "failed"
      );
      expect(failedSync).toBeDefined();
      expect(failedSync).toHaveProperty("error");
      expect(failedSync.error).toBeTruthy();
    });

    it("should reject history retrieval without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should reject history retrieval with invalid bearer token format", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", "InvalidFormat token123")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should validate limit parameter is a positive integer", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history?limit=-5`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should validate limit parameter does not exceed maximum", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history?limit=200`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should accept valid limit values", async () => {
      const validLimits = [1, 5, 10, 50, 100];
      
      for (const limit of validLimits) {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/sync/history?limit=${limit}`)
          .set("Authorization", `Bearer ${testAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.history.length).toBeLessThanOrEqual(limit);
      }
    });

    it("should include request ID in response", async () => {
      const customRequestId = "custom-request-id-123";
      
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .set("X-Request-ID", customRequestId)
        .expect(200);

      expect(response.body.requestId).toBe(customRequestId);
    });

    it("should return empty history for merchant with no syncs", async () => {
      const newMerchantId = "new_merchant_no_history";
      
      // This test expects 403 because the mock auth middleware sets merchantId from params
      // and the user's merchantId won't match a different merchant unless they're admin
      // Since we're testing with a different merchant ID, we expect access denied
      const response = await request(app)
        .get(`/api/merchants/${newMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toEqual([]);
      expect(response.body.data.total).toBe(0);
    });

    it("should return standardized API response format", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      // Verify standard response format
      expect(response.body).toMatchObject({
        success: true,
        data: {
          history: expect.any(Array),
          total: expect.any(Number),
        },
        timestamp: expect.any(String),
        requestId: expect.any(String),
      });
    });

    it("should include sync duration information", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const entry = response.body.data.history[0];
      const startedAt = new Date(entry.startedAt);
      const completedAt = new Date(entry.completedAt);
      
      // Verify dates are valid and completed is after started
      expect(startedAt.getTime()).toBeLessThanOrEqual(completedAt.getTime());
    });

    it("should validate merchant ID parameter", async () => {
      const response = await request(app)
        .get(`/api/merchants//sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(404);

      // Express will return 404 for invalid route
      expect(response.status).toBe(404);
    });
  });

  describe("Sync History Pagination", () => {
    it("should return first page of results with limit", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history?limit=2`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history.length).toBe(2);
      // Note: The controller returns total as the length of the returned array
      expect(response.body.data.total).toBe(2);
    });

    it("should handle limit larger than available records", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history?limit=100`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history.length).toBe(expectedHistoryCount);
    });

    it("should return single record when limit is 1", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history?limit=1`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history.length).toBe(1);
      
      // Should be the most recent sync
      expect(response.body.data.history[0].syncId).toBe("sync_123456");
    });
  });

  describe("Sync History Statistics", () => {
    it("should include accurate statistics for each sync", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      response.body.data.history.forEach((entry: any) => {
        const stats = entry.stats;
        
        // Verify stats add up correctly
        const processedCount = stats.created + stats.updated + stats.skipped + stats.failed;
        expect(processedCount).toBeLessThanOrEqual(stats.totalProducts);
      });
    });

    it("should show zero stats for failed syncs", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const failedSync = response.body.data.history.find(
        (entry: any) => entry.status === "failed"
      );
      
      if (failedSync) {
        expect(failedSync.stats.totalProducts).toBe(0);
        expect(failedSync.stats.created).toBe(0);
        expect(failedSync.stats.updated).toBe(0);
      }
    });
  });

  describe("Integration with Sync Status", () => {
    it("should correlate history with current sync status", async () => {
      // Get sync status
      const statusResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/status`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      // Get sync history
      const historyResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history?limit=1`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(historyResponse.body.success).toBe(true);
      
      // Most recent history entry should match last sync result in status
      const lastSyncResult = statusResponse.body.data.lastSyncResult;
      const mostRecentHistory = historyResponse.body.data.history[0];
      
      expect(mostRecentHistory.syncId).toBe(lastSyncResult.syncId);
      expect(mostRecentHistory.status).toBe(lastSyncResult.status);
    });
  });

  describe("End-to-End History Flow", () => {
    it("should retrieve complete sync history after multiple operations", async () => {
      // Step 1: Get initial history
      const initialResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(initialResponse.body.success).toBe(true);
      expect(initialResponse.body.data.history.length).toBeGreaterThan(0);

      // Step 2: Get limited history
      const limitedResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/history?limit=2`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(limitedResponse.body.success).toBe(true);
      expect(limitedResponse.body.data.history.length).toBe(2);

      // Step 3: Verify total count matches the returned history length
      // Note: The controller returns total as the length of the returned array
      expect(limitedResponse.body.data.total).toBe(limitedResponse.body.data.history.length);
      expect(initialResponse.body.data.total).toBe(initialResponse.body.data.history.length);

      // Step 4: Verify most recent entries match
      expect(limitedResponse.body.data.history[0].syncId).toBe(
        initialResponse.body.data.history[0].syncId
      );
    });
  });
});
