/**
 * Integration tests for Product Sync Configuration
 * Tests product sync configuration creation, retrieval, and validation
 *
 * Requirements: FR1, FR4
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

// Mock CacheService
const mockCache = new Map<string, any>();

vi.mock("../services/CacheService", () => ({
  getCacheService: vi.fn(() => ({
    get: vi.fn().mockImplementation(async (key: string) => {
      return mockCache.get(key) || null;
    }),
    set: vi.fn().mockImplementation(async (key: string, value: any) => {
      mockCache.set(key, value);
      return true;
    }),
    delete: vi.fn().mockImplementation(async (key: string) => {
      mockCache.delete(key);
      return true;
    }),
  })),
}));

// Mock DocumentRepository
vi.mock("../repositories/DocumentRepository", () => ({
  DocumentRepository: vi.fn(() => ({
    findBySku: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  })),
  getDocumentRepository: vi.fn(() => ({
    findBySku: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  })),
}));

// Mock MerchantRepository
vi.mock("../repositories/MerchantRepository", () => ({
  MerchantRepository: vi.fn(() => ({
    findByMerchantId: vi.fn().mockResolvedValue({
      merchantId: "test_merchant_123",
      email: "test@example.com",
      companyName: "Test Company",
      status: "active",
      plan: "starter",
      createdAt: new Date(),
    }),
  })),
  getMerchantRepository: vi.fn(() => ({
    findByMerchantId: vi.fn().mockResolvedValue({
      merchantId: "test_merchant_123",
      email: "test@example.com",
      companyName: "Test Company",
      status: "active",
      plan: "starter",
      createdAt: new Date(),
    }),
  })),
}));

// Mock DocumentIngestionService
vi.mock("../services/DocumentIngestionService", () => ({
  getDocumentIngestionService: vi.fn(() => ({
    ingestDocument: vi.fn().mockResolvedValue({}),
  })),
}));

// Mock MindsDBService
vi.mock("../services/MindsDBService", () => ({
  MindsDBService: vi.fn(() => ({
    query: vi.fn().mockResolvedValue({}),
  })),
}));

// Mock PIIRedactor
vi.mock("../services/PIIRedactor", () => ({
  getPIIRedactor: vi.fn(() => ({
    redactQuery: vi.fn().mockResolvedValue({ sanitizedText: "", tokens: new Map() }),
  })),
}));

// Mock EmbeddingService
vi.mock("../services/EmbeddingService", () => ({
  EmbeddingService: vi.fn(() => ({
    generateEmbedding: vi.fn().mockResolvedValue([]),
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

    // Set user with merchantId matching the request params or as admin
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

describe("Product Sync Configuration Tests", () => {
  let app: Application;
  const testMerchantId = "test_merchant_123";
  const testAccessToken = "mock-access-token-123";

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
    mockCache.clear();
  });

  describe("POST /api/merchants/:merchantId/sync/configure", () => {
    it("should successfully create sync configuration with manual sync", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "manual",
          sourceType: "csv",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
            price: "price",
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("message");
      expect(response.body.data.message).toContain("created successfully");
      expect(response.body.data.syncType).toBe("manual");
      expect(response.body.data.merchantId).toBe(testMerchantId);
    });

    it("should successfully create sync configuration with scheduled sync", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "scheduled",
          schedule: "daily",
          sourceType: "api",
          sourceUrl: "https://api.example.com/products",
          fieldMapping: {
            sku: "product_id",
            title: "product_name",
            description: "product_description",
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.syncType).toBe("scheduled");
      expect(response.body.data.schedule).toBe("daily");
    });

    it("should successfully create sync configuration with webhook sync", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "webhook",
          sourceType: "api",
          webhookSecret: "test_webhook_secret_123",
          fieldMapping: {
            sku: "sku",
            title: "title",
            description: "description",
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.syncType).toBe("webhook");
    });

    it("should update existing sync configuration", async () => {
      // First create a configuration
      await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "manual",
          sourceType: "csv",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        })
        .expect(201);

      // Then update it
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "scheduled",
          schedule: "hourly",
          sourceType: "api",
          sourceUrl: "https://api.example.com/products",
          fieldMapping: {
            sku: "id",
            title: "name",
            description: "description",
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain("updated successfully");
      expect(response.body.data.isUpdate).toBe(true);
    });

    it("should reject configuration without authentication", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .send({
          syncType: "manual",
          sourceType: "csv",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should reject configuration with missing syncType", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          sourceType: "csv",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("syncType");
    });

    it("should reject configuration with invalid syncType", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "invalid_type",
          sourceType: "csv",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject scheduled sync without schedule parameter", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "scheduled",
          sourceType: "api",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("schedule is required");
    });

    it("should reject configuration with invalid schedule value", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "scheduled",
          schedule: "invalid_schedule",
          sourceType: "api",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject configuration without fieldMapping", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "manual",
          sourceType: "csv",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject configuration with incomplete fieldMapping", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "manual",
          sourceType: "csv",
          fieldMapping: {
            sku: "sku",
            title: "name",
            // missing description
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Validation failed");
    });

    it("should accept configuration with optional field mappings", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "manual",
          sourceType: "csv",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
            price: "price",
            imageUrl: "image",
            category: "category",
            inStock: "stock",
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe("PUT /api/merchants/:merchantId/sync/configure", () => {
    it("should update sync configuration using PUT method", async () => {
      // First create a configuration
      await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "manual",
          sourceType: "csv",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        });

      // Update using PUT
      const response = await request(app)
        .put(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "scheduled",
          schedule: "daily",
          sourceType: "api",
          sourceUrl: "https://api.example.com/products",
          fieldMapping: {
            sku: "product_id",
            title: "product_name",
            description: "product_desc",
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain("updated successfully");
    });

    it("should create new configuration if none exists using PUT", async () => {
      const newMerchantId = "new_merchant_456";
      
      const response = await request(app)
        .put(`/api/merchants/${newMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "manual",
          sourceType: "csv",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain("created successfully");
    });
  });

  describe("GET /api/merchants/:merchantId/sync/configure", () => {
    it("should successfully retrieve sync configuration", async () => {
      // First create a configuration
      await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "scheduled",
          schedule: "daily",
          sourceType: "api",
          sourceUrl: "https://api.example.com/products",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        });

      // Then retrieve it
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId");
      expect(response.body.data).toHaveProperty("syncType");
      expect(response.body.data).toHaveProperty("fieldMapping");
      expect(response.body.data.syncType).toBe("scheduled");
      expect(response.body.data.schedule).toBe("daily");
    });

    it("should return 404 when configuration does not exist", async () => {
      const nonExistentMerchantId = "non_existent_merchant";
      
      const response = await request(app)
        .get(`/api/merchants/${nonExistentMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("not found");
    });

    it("should reject retrieval without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/sync/configure`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Unauthorized");
    });
  });

  describe("Configuration Validation", () => {
    it("should validate sourceType field", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "manual",
          sourceType: "invalid_source",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should validate sourceUrl format when provided", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "scheduled",
          schedule: "daily",
          sourceType: "api",
          sourceUrl: "not-a-valid-url",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should accept valid sourceUrl", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "scheduled",
          schedule: "daily",
          sourceType: "api",
          sourceUrl: "https://api.example.com/products",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe("End-to-End Configuration Flow", () => {
    it("should complete full configuration lifecycle", async () => {
      const merchantId = `e2e_merchant_${Date.now()}`;

      // Step 1: Create initial configuration
      const createResponse = await request(app)
        .post(`/api/merchants/${merchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "manual",
          sourceType: "csv",
          fieldMapping: {
            sku: "sku",
            title: "name",
            description: "desc",
          },
        })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.message).toContain("created");

      // Step 2: Retrieve configuration
      const getResponse = await request(app)
        .get(`/api/merchants/${merchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.syncType).toBe("manual");

      // Step 3: Update configuration
      const updateResponse = await request(app)
        .put(`/api/merchants/${merchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          syncType: "scheduled",
          schedule: "hourly",
          sourceType: "api",
          sourceUrl: "https://api.example.com/products",
          fieldMapping: {
            sku: "product_id",
            title: "product_name",
            description: "product_description",
            price: "price",
            imageUrl: "image_url",
          },
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.message).toContain("updated");

      // Step 4: Verify updated configuration
      const verifyResponse = await request(app)
        .get(`/api/merchants/${merchantId}/sync/configure`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.data.syncType).toBe("scheduled");
      expect(verifyResponse.body.data.schedule).toBe("hourly");
    });
  });
});
