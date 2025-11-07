/**
 * Integration tests for Usage Tracking and Analytics API Endpoints
 * Tests usage tracking, history, forecasting, and limit management
 *
 * Requirements: 4.1, 4.2, 4.3, 5.1, 5.2
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

// Mock all problematic services BEFORE any imports
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

vi.mock("../services/BedrockAgentService", () => ({
  getBedrockAgentService: vi.fn(() => ({
    processChat: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("../services/OrchestrationService", () => ({
  getOrchestrationService: vi.fn(() => ({
    processQuery: vi.fn().mockResolvedValue({}),
  })),
}));

// Mock database repositories
const usageStore = new Map<string, any>();
const usageLimitsStore = new Map<string, any>();

vi.mock("../repositories/UsageRepository", () => ({
  getUsageRepository: vi.fn(() => ({
    create: vi.fn().mockImplementation((data: any) => {
      const usage = {
        ...data,
        id: `usage_${Date.now()}_${Math.random()}`,
        timestamp: new Date(),
      };
      const key = `${data.merchantId}_${data.timestamp.getTime()}`;
      usageStore.set(key, usage);
      return Promise.resolve(usage);
    }),
    findByMerchantId: vi.fn().mockImplementation((merchantId: string, startDate?: Date, endDate?: Date) => {
      const usages = Array.from(usageStore.values()).filter((usage: any) => {
        if (usage.merchantId !== merchantId) return false;
        if (startDate && usage.timestamp < startDate) return false;
        if (endDate && usage.timestamp > endDate) return false;
        return true;
      });
      return Promise.resolve(usages);
    }),
    getCurrentUsage: vi.fn().mockImplementation((merchantId: string) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const usages = Array.from(usageStore.values()).filter(
        (usage: any) => usage.merchantId === merchantId && usage.timestamp >= startOfMonth
      );
      
      return Promise.resolve({
        merchantId,
        period: { start: startOfMonth, end: now },
        queries: usages.filter((u: any) => u.metricType === 'queries').length,
        documents: usages.filter((u: any) => u.metricType === 'documents').length,
        apiCalls: usages.filter((u: any) => u.metricType === 'apiCalls').length,
        storageGb: usages.reduce((sum: number, u: any) => u.metricType === 'storage' ? sum + (u.value || 0) : sum, 0),
      });
    }),
    aggregateByPeriod: vi.fn().mockImplementation((merchantId: string, metricType: string, startDate: Date, endDate: Date, granularity: string) => {
      const usages = Array.from(usageStore.values()).filter((usage: any) => {
        return usage.merchantId === merchantId &&
               usage.metricType === metricType &&
               usage.timestamp >= startDate &&
               usage.timestamp <= endDate;
      });

      // Simple aggregation by day
      const aggregated: any[] = [];
      const dayMap = new Map<string, number>();
      
      usages.forEach((usage: any) => {
        const day = usage.timestamp.toISOString().split('T')[0];
        dayMap.set(day, (dayMap.get(day) || 0) + (usage.value || 1));
      });

      dayMap.forEach((value, date) => {
        aggregated.push({ date, value });
      });

      return Promise.resolve(aggregated);
    }),
  })),
}));

vi.mock("../repositories/UsageLimitsRepository", () => ({
  getUsageLimitsRepository: vi.fn(() => ({
    findByMerchantId: vi.fn().mockImplementation((merchantId: string) => {
      return Promise.resolve(usageLimitsStore.get(merchantId) || {
        merchantId,
        plan: 'starter',
        queriesPerMonth: 1000,
        documentsMax: 100,
        apiCallsPerDay: 5000,
        storageGbMax: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }),
    create: vi.fn().mockImplementation((data: any) => {
      const limits = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usageLimitsStore.set(data.merchantId, limits);
      return Promise.resolve(limits);
    }),
    update: vi.fn().mockImplementation((merchantId: string, data: any) => {
      const existing = usageLimitsStore.get(merchantId) || {};
      const updated = {
        ...existing,
        ...data,
        merchantId,
        updatedAt: new Date(),
      };
      usageLimitsStore.set(merchantId, updated);
      return Promise.resolve(updated);
    }),
    upsert: vi.fn().mockImplementation((merchantId: string, data: any) => {
      const limits = {
        merchantId,
        ...data,
        createdAt: usageLimitsStore.get(merchantId)?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      usageLimitsStore.set(merchantId, limits);
      return Promise.resolve(limits);
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
      roles: req.headers["x-test-roles"] ? req.headers["x-test-roles"].split(",") : ["merchant_admin"],
    };
    next();
  }),
  AuthenticatedRequest: vi.fn(),
}));

// Now import after mocks
import request from "supertest";
import express, { Application } from "express";
import usageRoutes from "../api/routes/usage";

describe("Usage Tracking Integration Tests", () => {
  let app: Application;
  const testMerchantId = "test_merchant_123";
  const testAccessToken = "mock-access-token-123";

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.headers["x-request-id"] = req.headers["x-request-id"] || "test-request-id";
      next();
    });
    app.use("/api/merchants", usageRoutes);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    usageStore.clear();
    usageLimitsStore.clear();
  });

  describe("GET /api/merchants/:merchantId/usage/current", () => {
    it("should successfully get current usage", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/current`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("period");
      expect(response.body.data).toHaveProperty("queries");
      expect(response.body.data).toHaveProperty("documents");
      expect(response.body.data).toHaveProperty("apiCalls");
      expect(response.body.data).toHaveProperty("storageGb");
    });

    it("should accept custom date range", async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/current`)
        .query({ startDate, endDate })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toHaveProperty("startDate");
      expect(response.body.data.period).toHaveProperty("endDate");
    });

    it("should reject invalid startDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/current`)
        .query({ startDate: "invalid-date" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid date format");
    });

    it("should reject when startDate is after endDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/current`)
        .query({ 
          startDate: "2025-12-31", 
          endDate: "2025-01-01" 
        })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("startDate must be before endDate");
    });

    it("should reject without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/current`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/merchants/:merchantId/usage/history", () => {
    beforeEach(async () => {
      // Create some test usage data
      const usageRepo = (await import("../repositories/UsageRepository")).getUsageRepository();
      const now = new Date();
      
      for (let i = 0; i < 5; i++) {
        await usageRepo.create({
          merchantId: testMerchantId,
          metricType: "queries",
          value: 10 + i,
          timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
        });
      }
    });

    it("should successfully get usage history", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/history`)
        .query({ metricType: "queries" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId", testMerchantId);
      expect(response.body.data).toHaveProperty("metricType", "queries");
      expect(response.body.data).toHaveProperty("history");
      expect(response.body.data.history).toBeInstanceOf(Array);
    });

    it("should require metricType parameter", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/history`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("metricType");
    });

    it("should validate metricType is valid", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/history`)
        .query({ metricType: "invalid_metric" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid metricType");
    });

    it("should accept custom date range", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/history`)
        .query({ metricType: "queries", startDate, endDate })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should reject without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/history`)
        .query({ metricType: "queries" })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/merchants/:merchantId/usage/forecast", () => {
    beforeEach(async () => {
      // Create historical usage data for forecasting
      const usageRepo = (await import("../repositories/UsageRepository")).getUsageRepository();
      const now = new Date();
      
      for (let i = 0; i < 30; i++) {
        await usageRepo.create({
          merchantId: testMerchantId,
          metricType: "queries",
          value: 100 + Math.floor(Math.random() * 50),
          timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
        });
      }
    });

    it("should successfully get usage forecast", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/forecast`)
        .query({ metricType: "queries" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId", testMerchantId);
      expect(response.body.data).toHaveProperty("metricType", "queries");
      // Forecast structure depends on service implementation
      expect(response.body.data).toBeDefined();
    });

    it("should require metricType parameter", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/forecast`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("metricType");
    });

    it("should validate metricType is valid", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/forecast`)
        .query({ metricType: "invalid_metric" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid metricType");
    });

    it("should reject without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/forecast`)
        .query({ metricType: "queries" })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/merchants/:merchantId/usage/limits", () => {
    it("should successfully set usage limits with admin role", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/usage/limits`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .set("x-test-roles", "admin")
        .send({
          plan: "professional",
          queriesPerMonth: 10000,
          documentsMax: 1000,
          apiCallsPerDay: 50000,
          storageGbMax: 10,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId", testMerchantId);
      expect(response.body.data).toHaveProperty("plan", "professional");
      expect(response.body.data).toHaveProperty("queriesPerMonth", 10000);
    });

    it("should reject without admin role", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/usage/limits`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          plan: "professional",
          queriesPerMonth: 10000,
          documentsMax: 1000,
          apiCallsPerDay: 50000,
          storageGbMax: 10,
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Admin access required");
    });

    it("should validate all required fields", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/usage/limits`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .set("x-test-roles", "admin")
        .send({
          plan: "professional",
          // Missing other required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("All limit fields are required");
    });

    it("should validate plan is valid", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/usage/limits`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .set("x-test-roles", "admin")
        .send({
          plan: "invalid_plan",
          queriesPerMonth: 10000,
          documentsMax: 1000,
          apiCallsPerDay: 50000,
          storageGbMax: 10,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid plan");
    });

    it("should validate numeric values are non-negative", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/usage/limits`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .set("x-test-roles", "admin")
        .send({
          plan: "professional",
          queriesPerMonth: -1000,
          documentsMax: 1000,
          apiCallsPerDay: 50000,
          storageGbMax: 10,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("non-negative");
    });

    it("should reject without authentication", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/usage/limits`)
        .send({
          plan: "professional",
          queriesPerMonth: 10000,
          documentsMax: 1000,
          apiCallsPerDay: 50000,
          storageGbMax: 10,
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("End-to-End Usage Tracking Flow", () => {
    it("should complete full usage tracking lifecycle", async () => {
      // Step 1: Set usage limits (as admin)
      const limitsResponse = await request(app)
        .post(`/api/merchants/${testMerchantId}/usage/limits`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .set("x-test-roles", "admin")
        .send({
          plan: "professional",
          queriesPerMonth: 10000,
          documentsMax: 1000,
          apiCallsPerDay: 50000,
          storageGbMax: 10,
        })
        .expect(200);

      expect(limitsResponse.body.success).toBe(true);

      // Step 2: Simulate some usage
      const usageRepo = (await import("../repositories/UsageRepository")).getUsageRepository();
      const now = new Date();
      
      for (let i = 0; i < 5; i++) {
        await usageRepo.create({
          merchantId: testMerchantId,
          metricType: "queries",
          value: 100,
          timestamp: new Date(now.getTime() - i * 60 * 60 * 1000),
        });
      }

      // Step 3: Get current usage
      const currentResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/current`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(currentResponse.body.success).toBe(true);
      expect(currentResponse.body.data.queries).toBeDefined();
      expect(currentResponse.body.data.queries).toHaveProperty("count");

      // Step 4: Get usage history
      const historyResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/history`)
        .query({ metricType: "queries" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data.history).toBeInstanceOf(Array);

      // Step 5: Get usage forecast
      const forecastResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/usage/forecast`)
        .query({ metricType: "queries" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(forecastResponse.body.success).toBe(true);
      expect(forecastResponse.body.data).toBeDefined();
    });
  });
});
