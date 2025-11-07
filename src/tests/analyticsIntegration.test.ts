/**
 * Integration tests for Analytics API Endpoints
 * Tests analytics overview, queries, top queries, performance, and intent distribution
 *
 * Requirements: 5.1, 5.2
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

// Define mock data before using it in mocks
const mockAnalyticsData = {
  overview: {
    totalQueries: 1250,
    activeSessions: 45,
    avgResponseTime: 320,
    successRate: 95.5,
    topQueries: [
      { query: "What are your best sellers?", count: 150, avgConfidence: 0.92 },
      { query: "Do you have free shipping?", count: 120, avgConfidence: 0.88 },
      { query: "What's your return policy?", count: 95, avgConfidence: 0.85 },
    ],
  },
  queryTimeSeries: [
    { timestamp: "2025-01-01T00:00:00Z", count: 45, avgResponseTime: 310, successRate: 96 },
    { timestamp: "2025-01-02T00:00:00Z", count: 52, avgResponseTime: 325, successRate: 95 },
    { timestamp: "2025-01-03T00:00:00Z", count: 48, avgResponseTime: 315, successRate: 97 },
  ],
  topQueries: [
    { query: "What are your best sellers?", count: 150, avgConfidence: 0.92 },
    { query: "Do you have free shipping?", count: 120, avgConfidence: 0.88 },
    { query: "What's your return policy?", count: 95, avgConfidence: 0.85 },
    { query: "How long does shipping take?", count: 80, avgConfidence: 0.90 },
    { query: "Do you ship internationally?", count: 75, avgConfidence: 0.87 },
  ],
  performance: {
    avgResponseTime: 320,
    p50ResponseTime: 280,
    p95ResponseTime: 450,
    p99ResponseTime: 650,
    cacheHitRate: 75.5,
    errorRate: 4.5,
    uptime: 99.8,
  },
  intents: [
    { intent: "product_search", count: 450, percentage: 36 },
    { intent: "shipping_inquiry", count: 350, percentage: 28 },
    { intent: "return_policy", count: 250, percentage: 20 },
    { intent: "pricing", count: 150, percentage: 12 },
    { intent: "other", count: 50, percentage: 4 },
  ],
};

// Mock AnalyticsService with the data defined above
vi.mock("../services/AnalyticsService", () => {
  const data = {
    overview: {
      totalQueries: 1250,
      activeSessions: 45,
      avgResponseTime: 320,
      successRate: 95.5,
      topQueries: [
        { query: "What are your best sellers?", count: 150, avgConfidence: 0.92 },
        { query: "Do you have free shipping?", count: 120, avgConfidence: 0.88 },
        { query: "What's your return policy?", count: 95, avgConfidence: 0.85 },
      ],
    },
    queryTimeSeries: [
      { timestamp: "2025-01-01T00:00:00Z", count: 45, avgResponseTime: 310, successRate: 96 },
      { timestamp: "2025-01-02T00:00:00Z", count: 52, avgResponseTime: 325, successRate: 95 },
      { timestamp: "2025-01-03T00:00:00Z", count: 48, avgResponseTime: 315, successRate: 97 },
    ],
    topQueries: [
      { query: "What are your best sellers?", count: 150, avgConfidence: 0.92 },
      { query: "Do you have free shipping?", count: 120, avgConfidence: 0.88 },
      { query: "What's your return policy?", count: 95, avgConfidence: 0.85 },
      { query: "How long does shipping take?", count: 80, avgConfidence: 0.90 },
      { query: "Do you ship internationally?", count: 75, avgConfidence: 0.87 },
    ],
    performance: {
      avgResponseTime: 320,
      p50ResponseTime: 280,
      p95ResponseTime: 450,
      p99ResponseTime: 650,
      cacheHitRate: 75.5,
      errorRate: 4.5,
      uptime: 99.8,
    },
    intents: [
      { intent: "product_search", count: 450, percentage: 36 },
      { intent: "shipping_inquiry", count: 350, percentage: 28 },
      { intent: "return_policy", count: 250, percentage: 20 },
      { intent: "pricing", count: 150, percentage: 12 },
      { intent: "other", count: 50, percentage: 4 },
    ],
  };

  return {
    AnalyticsService: vi.fn(() => ({
      getOverview: vi.fn().mockResolvedValue(data.overview),
      getQueryTimeSeries: vi.fn().mockResolvedValue(data.queryTimeSeries),
      getTopQueries: vi.fn().mockResolvedValue(data.topQueries),
      getPerformanceMetrics: vi.fn().mockResolvedValue(data.performance),
      getIntentDistribution: vi.fn().mockResolvedValue(data.intents),
    })),
  };
});

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

    // Set user to test_merchant_123 by default, unless admin role is specified
    req.user = {
      merchantId: "test_merchant_123",
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
import analyticsRoutes from "../api/routes/analytics";

describe("Analytics Integration Tests", () => {
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
    app.use("/api/merchants", analyticsRoutes);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/merchants/:merchantId/analytics/overview", () => {
    it("should successfully get analytics overview", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/overview`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("totalQueries");
      expect(response.body.data).toHaveProperty("activeSessions");
      expect(response.body.data).toHaveProperty("avgResponseTime");
      expect(response.body.data).toHaveProperty("successRate");
      expect(response.body.data).toHaveProperty("topQueries");
      expect(response.body.data).toHaveProperty("period");
      expect(response.body.data.period).toHaveProperty("startDate");
      expect(response.body.data.period).toHaveProperty("endDate");
    });

    it("should accept custom date range", async () => {
      const startDate = "2025-01-01";
      const endDate = "2025-01-31";

      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/overview`)
        .query({ startDate, endDate })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period.startDate).toContain("2025-01-01");
      expect(response.body.data.period.endDate).toContain("2025-01-31");
    });

    it("should reject invalid startDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/overview`)
        .query({ startDate: "invalid-date" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid date format");
    });

    it("should reject invalid endDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/overview`)
        .query({ endDate: "invalid-date" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid date format");
    });

    it("should reject when startDate is after endDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/overview`)
        .query({ startDate: "2025-12-31", endDate: "2025-01-01" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("startDate must be before endDate");
    });

    it("should reject without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/overview`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should reject access to other merchant's analytics", async () => {
      const response = await request(app)
        .get(`/api/merchants/other_merchant_456/analytics/overview`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Access denied");
    });

    it("should allow admin to access any merchant's analytics", async () => {
      const response = await request(app)
        .get(`/api/merchants/other_merchant_456/analytics/overview`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .set("x-test-roles", "admin")
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /api/merchants/:merchantId/analytics/queries", () => {
    it("should successfully get query time series data", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/queries`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId", testMerchantId);
      expect(response.body.data).toHaveProperty("startDate");
      expect(response.body.data).toHaveProperty("endDate");
      expect(response.body.data).toHaveProperty("groupBy", "day");
      expect(response.body.data).toHaveProperty("queries");
      expect(response.body.data.queries).toBeInstanceOf(Array);
    });

    it("should accept groupBy parameter as 'hour'", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/queries`)
        .query({ groupBy: "hour" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.groupBy).toBe("hour");
    });

    it("should accept groupBy parameter as 'day'", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/queries`)
        .query({ groupBy: "day" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.groupBy).toBe("day");
    });

    it("should reject invalid groupBy parameter", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/queries`)
        .query({ groupBy: "week" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid groupBy parameter");
    });

    it("should accept custom date range", async () => {
      const startDate = "2025-01-01";
      const endDate = "2025-01-31";

      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/queries`)
        .query({ startDate, endDate })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.startDate).toContain("2025-01-01");
      expect(response.body.data.endDate).toContain("2025-01-31");
    });

    it("should reject invalid startDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/queries`)
        .query({ startDate: "not-a-date" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid date format");
    });

    it("should reject when startDate is after endDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/queries`)
        .query({ startDate: "2025-12-31", endDate: "2025-01-01" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("startDate must be before endDate");
    });

    it("should reject without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/queries`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should reject access to other merchant's data", async () => {
      const response = await request(app)
        .get(`/api/merchants/other_merchant_456/analytics/queries`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Access denied");
    });
  });

  describe("GET /api/merchants/:merchantId/analytics/top-queries", () => {
    it("should successfully get top queries", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId", testMerchantId);
      expect(response.body.data).toHaveProperty("startDate");
      expect(response.body.data).toHaveProperty("endDate");
      expect(response.body.data).toHaveProperty("limit", 20);
      expect(response.body.data).toHaveProperty("topQueries");
      expect(response.body.data.topQueries).toBeInstanceOf(Array);
    });

    it("should accept custom limit parameter", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
        .query({ limit: 10 })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.limit).toBe(10);
    });

    it("should reject limit less than 1", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
        .query({ limit: 0 })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid limit parameter");
    });

    it("should reject limit greater than 100", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
        .query({ limit: 101 })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid limit parameter");
    });

    it("should reject non-numeric limit", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
        .query({ limit: "abc" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid limit parameter");
    });

    it("should accept custom date range", async () => {
      const startDate = "2025-01-01";
      const endDate = "2025-01-31";

      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
        .query({ startDate, endDate, limit: 5 })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.startDate).toContain("2025-01-01");
      expect(response.body.data.endDate).toContain("2025-01-31");
      expect(response.body.data.limit).toBe(5);
    });

    it("should reject invalid date format", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
        .query({ startDate: "invalid" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid date format");
    });

    it("should reject when startDate is after endDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
        .query({ startDate: "2025-12-31", endDate: "2025-01-01" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("startDate must be before endDate");
    });

    it("should reject without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should reject access to other merchant's data", async () => {
      const response = await request(app)
        .get(`/api/merchants/other_merchant_456/analytics/top-queries`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Access denied");
    });
  });

  describe("GET /api/merchants/:merchantId/analytics/performance", () => {
    it("should successfully get performance metrics", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/performance`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId", testMerchantId);
      expect(response.body.data).toHaveProperty("startDate");
      expect(response.body.data).toHaveProperty("endDate");
      expect(response.body.data).toHaveProperty("avgResponseTime");
      expect(response.body.data).toHaveProperty("p50ResponseTime");
      expect(response.body.data).toHaveProperty("p95ResponseTime");
      expect(response.body.data).toHaveProperty("p99ResponseTime");
      expect(response.body.data).toHaveProperty("cacheHitRate");
      expect(response.body.data).toHaveProperty("errorRate");
      expect(response.body.data).toHaveProperty("uptime");
    });

    it("should accept custom date range", async () => {
      const startDate = "2025-01-01";
      const endDate = "2025-01-31";

      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/performance`)
        .query({ startDate, endDate })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.startDate).toContain("2025-01-01");
      expect(response.body.data.endDate).toContain("2025-01-31");
    });

    it("should reject invalid startDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/performance`)
        .query({ startDate: "not-a-date" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid date format");
    });

    it("should reject when startDate is after endDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/performance`)
        .query({ startDate: "2025-12-31", endDate: "2025-01-01" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("startDate must be before endDate");
    });

    it("should reject without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/performance`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should reject access to other merchant's data", async () => {
      const response = await request(app)
        .get(`/api/merchants/other_merchant_456/analytics/performance`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Access denied");
    });

    it("should allow admin to access any merchant's performance data", async () => {
      const response = await request(app)
        .get(`/api/merchants/other_merchant_456/analytics/performance`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .set("x-test-roles", "admin")
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /api/merchants/:merchantId/analytics/intents", () => {
    it("should successfully get intent distribution", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/intents`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId", testMerchantId);
      expect(response.body.data).toHaveProperty("startDate");
      expect(response.body.data).toHaveProperty("endDate");
      expect(response.body.data).toHaveProperty("intents");
      expect(response.body.data.intents).toBeInstanceOf(Array);
    });

    it("should accept custom date range", async () => {
      const startDate = "2025-01-01";
      const endDate = "2025-01-31";

      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/intents`)
        .query({ startDate, endDate })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.startDate).toContain("2025-01-01");
      expect(response.body.data.endDate).toContain("2025-01-31");
    });

    it("should reject invalid startDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/intents`)
        .query({ startDate: "invalid-date" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid date format");
    });

    it("should reject when startDate is after endDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/intents`)
        .query({ startDate: "2025-12-31", endDate: "2025-01-01" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("startDate must be before endDate");
    });

    it("should reject without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/intents`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should reject access to other merchant's data", async () => {
      const response = await request(app)
        .get(`/api/merchants/other_merchant_456/analytics/intents`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Access denied");
    });
  });

  describe("End-to-End Analytics Flow", () => {
    it("should complete full analytics workflow", async () => {
      // Step 1: Get overview
      const overviewResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/overview`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(overviewResponse.body.success).toBe(true);
      expect(overviewResponse.body.data.totalQueries).toBeGreaterThan(0);

      // Step 2: Get query time series with hourly grouping
      const queriesResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/queries`)
        .query({ groupBy: "hour" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(queriesResponse.body.success).toBe(true);
      expect(queriesResponse.body.data.groupBy).toBe("hour");
      expect(queriesResponse.body.data.queries).toBeInstanceOf(Array);

      // Step 3: Get top 10 queries
      const topQueriesResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
        .query({ limit: 10 })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(topQueriesResponse.body.success).toBe(true);
      expect(topQueriesResponse.body.data.limit).toBe(10);
      expect(topQueriesResponse.body.data.topQueries).toBeInstanceOf(Array);

      // Step 4: Get performance metrics
      const performanceResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/performance`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(performanceResponse.body.success).toBe(true);
      expect(performanceResponse.body.data).toHaveProperty("avgResponseTime");
      expect(performanceResponse.body.data).toHaveProperty("cacheHitRate");
      expect(performanceResponse.body.data).toHaveProperty("uptime");

      // Step 5: Get intent distribution
      const intentsResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/intents`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(intentsResponse.body.success).toBe(true);
      expect(intentsResponse.body.data.intents).toBeInstanceOf(Array);

      // Step 6: Get analytics for specific date range across all endpoints
      const startDate = "2025-01-01";
      const endDate = "2025-01-31";

      const dateRangeOverview = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/overview`)
        .query({ startDate, endDate })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(dateRangeOverview.body.success).toBe(true);
      expect(dateRangeOverview.body.data.period.startDate).toContain("2025-01-01");

      const dateRangeQueries = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/queries`)
        .query({ startDate, endDate, groupBy: "day" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(dateRangeQueries.body.success).toBe(true);
      expect(dateRangeQueries.body.data.startDate).toContain("2025-01-01");

      const dateRangeTopQueries = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
        .query({ startDate, endDate, limit: 5 })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(dateRangeTopQueries.body.success).toBe(true);
      expect(dateRangeTopQueries.body.data.startDate).toContain("2025-01-01");

      const dateRangePerformance = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/performance`)
        .query({ startDate, endDate })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(dateRangePerformance.body.success).toBe(true);
      expect(dateRangePerformance.body.data.startDate).toContain("2025-01-01");

      const dateRangeIntents = await request(app)
        .get(`/api/merchants/${testMerchantId}/analytics/intents`)
        .query({ startDate, endDate })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(dateRangeIntents.body.success).toBe(true);
      expect(dateRangeIntents.body.data.startDate).toContain("2025-01-01");
    });
  });
});
