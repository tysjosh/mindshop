/**
 * Integration tests for API Key Management Endpoints
 * Tests API key creation, listing, revocation, rotation, and usage tracking
 *
 * Requirements: 3.1, 3.2, 3.3
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
const apiKeyStore = new Map<string, any>();
const apiKeyUsageStore: any[] = [];

vi.mock("../repositories/ApiKeyRepository", () => ({
  getApiKeyRepository: vi.fn(() => ({
    create: vi.fn().mockImplementation((data: any) => {
      const apiKey = {
        ...data,
        id: `id_${Date.now()}`,
        status: 'active',
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      apiKeyStore.set(data.keyId, apiKey);
      return Promise.resolve(apiKey);
    }),
    findByKeyId: vi.fn().mockImplementation((keyId: string) => {
      return Promise.resolve(apiKeyStore.get(keyId) || null);
    }),
    findByMerchantId: vi.fn().mockImplementation((merchantId: string, includeRevoked: boolean) => {
      const keys = Array.from(apiKeyStore.values()).filter(
        (key: any) => key.merchantId === merchantId && (includeRevoked || key.status === 'active')
      );
      return Promise.resolve(keys);
    }),
    findByPrefix: vi.fn().mockImplementation((prefix: string) => {
      const keys = Array.from(apiKeyStore.values()).filter(
        (key: any) => key.keyPrefix === prefix
      );
      return Promise.resolve(keys);
    }),
    revoke: vi.fn().mockImplementation((keyId: string) => {
      const key = apiKeyStore.get(keyId);
      if (!key) throw new Error('API key not found');
      key.status = 'revoked';
      key.updatedAt = new Date();
      apiKeyStore.set(keyId, key);
      return Promise.resolve(key);
    }),
    update: vi.fn().mockImplementation((keyId: string, data: any) => {
      const key = apiKeyStore.get(keyId);
      if (!key) throw new Error('API key not found');
      const updated = { ...key, ...data, updatedAt: new Date() };
      apiKeyStore.set(keyId, updated);
      return Promise.resolve(updated);
    }),
    updateLastUsed: vi.fn().mockImplementation((keyId: string) => {
      const key = apiKeyStore.get(keyId);
      if (key) {
        key.lastUsedAt = new Date();
        apiKeyStore.set(keyId, key);
      }
      return Promise.resolve();
    }),
    markAsExpired: vi.fn().mockImplementation((keyId: string) => {
      const key = apiKeyStore.get(keyId);
      if (key) {
        key.status = 'expired';
        apiKeyStore.set(keyId, key);
      }
      return Promise.resolve();
    }),
    findExpiredKeys: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../repositories/ApiKeyUsageRepository", () => ({
  getApiKeyUsageRepository: vi.fn(() => ({
    create: vi.fn().mockImplementation((data: any) => {
      const usage = {
        ...data,
        id: `usage_${Date.now()}`,
        timestamp: new Date(),
      };
      apiKeyUsageStore.push(usage);
      return Promise.resolve(usage);
    }),
    findByDateRange: vi.fn().mockImplementation((keyId: string, startDate: Date, endDate: Date) => {
      return Promise.resolve(
        apiKeyUsageStore.filter(
          (usage: any) =>
            usage.keyId === keyId &&
            usage.timestamp >= startDate &&
            usage.timestamp <= endDate
        )
      );
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

    // Mock authenticated user
    req.user = {
      merchantId: req.params.merchantId || "test_merchant_123",
      email: "test@example.com",
      roles: ["merchant_admin"],
    };
    next();
  }),
  AuthenticatedRequest: vi.fn(),
}));

// Now import after mocks
import request from "supertest";
import express, { Application } from "express";
import apiKeyRoutes from "../api/routes/apiKeys";

describe("API Key Integration Tests", () => {
  let app: Application;
  const testMerchantId = "test_merchant_123";
  const testAccessToken = "mock-access-token-123";
  let testKeyId: string;
  let testApiKey: string;

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
    app.use("/api/merchants", apiKeyRoutes);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    apiKeyStore.clear();
    apiKeyUsageStore.length = 0;
  });

  describe("POST /api/merchants/:merchantId/api-keys", () => {
    it("should successfully create a new API key", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "Production API Key",
          environment: "production",
          permissions: ["chat:read", "documents:write"],
          expiresInDays: 365,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("keyId");
      expect(response.body.data).toHaveProperty("key");
      expect(response.body.data).toHaveProperty("prefix", "pk_live_");
      expect(response.body.data).toHaveProperty("environment", "production");
      expect(response.body.data).toHaveProperty("expiresAt");
      expect(response.body.data).toHaveProperty("warning");
      expect(response.body.data.warning).toContain("only time");

      testKeyId = response.body.data.keyId;
      testApiKey = response.body.data.key;
    });

    it("should create a development API key with correct prefix", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "Development API Key",
          environment: "development",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.prefix).toBe("pk_test_");
      expect(response.body.data.environment).toBe("development");
    });

    it("should reject creation without authentication", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .send({
          name: "Test Key",
          environment: "production",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should reject creation with missing name", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          environment: "production",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("required");
    });

    it("should reject creation with invalid environment", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "Test Key",
          environment: "invalid",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("development");
    });

    it("should reject creation with invalid expiresInDays", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "Test Key",
          environment: "production",
          expiresInDays: -1,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("positive");
    });
  });

  describe("GET /api/merchants/:merchantId/api-keys", () => {
    beforeEach(async () => {
      // Create some test API keys
      await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "Key 1",
          environment: "production",
        });

      await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "Key 2",
          environment: "development",
        });
    });

    it("should successfully list all API keys", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("keys");
      expect(response.body.data).toHaveProperty("total");
      expect(response.body.data.keys).toBeInstanceOf(Array);
      expect(response.body.data.keys.length).toBeGreaterThan(0);
      expect(response.body.data.total).toBe(response.body.data.keys.length);

      // Verify key structure
      const key = response.body.data.keys[0];
      expect(key).toHaveProperty("keyId");
      expect(key).toHaveProperty("name");
      expect(key).toHaveProperty("keyPrefix");
      expect(key).toHaveProperty("environment");
      expect(key).toHaveProperty("status");
      expect(key).not.toHaveProperty("keyHash"); // Should not expose hash
    });

    it("should filter out revoked keys by default", async () => {
      // Create and revoke a key
      const createResponse = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "To Be Revoked",
          environment: "production",
        });

      const keyId = createResponse.body.data.keyId;

      await request(app)
        .delete(`/api/merchants/${testMerchantId}/api-keys/${keyId}`)
        .set("Authorization", `Bearer ${testAccessToken}`);

      // List without includeRevoked
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const revokedKey = response.body.data.keys.find((k: any) => k.keyId === keyId);
      expect(revokedKey).toBeUndefined();
    });

    it("should include revoked keys when requested", async () => {
      // Create and revoke a key
      const createResponse = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "To Be Revoked",
          environment: "production",
        });

      const keyId = createResponse.body.data.keyId;

      await request(app)
        .delete(`/api/merchants/${testMerchantId}/api-keys/${keyId}`)
        .set("Authorization", `Bearer ${testAccessToken}`);

      // List with includeRevoked
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys?includeRevoked=true`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const revokedKey = response.body.data.keys.find((k: any) => k.keyId === keyId);
      expect(revokedKey).toBeDefined();
      expect(revokedKey.status).toBe("revoked");
    });

    it("should reject listing without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("DELETE /api/merchants/:merchantId/api-keys/:keyId", () => {
    let keyIdToRevoke: string;

    beforeEach(async () => {
      // Create a test API key
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "Key to Revoke",
          environment: "production",
        });

      keyIdToRevoke = response.body.data.keyId;
    });

    it("should successfully revoke an API key", async () => {
      const response = await request(app)
        .delete(`/api/merchants/${testMerchantId}/api-keys/${keyIdToRevoke}`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("keyId", keyIdToRevoke);
      expect(response.body.data).toHaveProperty("status", "revoked");
      expect(response.body.data).toHaveProperty("message");
      expect(response.body.data.message).toContain("revoked");
    });

    it("should reject revocation without authentication", async () => {
      const response = await request(app)
        .delete(`/api/merchants/${testMerchantId}/api-keys/${keyIdToRevoke}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should handle revocation of non-existent key", async () => {
      const response = await request(app)
        .delete(`/api/merchants/${testMerchantId}/api-keys/non_existent_key`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/merchants/:merchantId/api-keys/:keyId/rotate", () => {
    let keyIdToRotate: string;

    beforeEach(async () => {
      // Create a test API key
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "Key to Rotate",
          environment: "production",
          permissions: ["chat:read"],
        });

      keyIdToRotate = response.body.data.keyId;
    });

    it("should successfully rotate an API key", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys/${keyIdToRotate}/rotate`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          gracePeriodDays: 7,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("keyId");
      expect(response.body.data).toHaveProperty("key");
      expect(response.body.data).toHaveProperty("oldKeyId", keyIdToRotate);
      expect(response.body.data).toHaveProperty("gracePeriodDays", 7);
      expect(response.body.data).toHaveProperty("message");
      expect(response.body.data.message).toContain("7 days");
      expect(response.body.data).toHaveProperty("warning");

      // New key should be different from old key
      expect(response.body.data.keyId).not.toBe(keyIdToRotate);
    });

    it("should rotate with default grace period", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys/${keyIdToRotate}/rotate`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({})
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.gracePeriodDays).toBe(7);
    });

    it("should reject rotation with invalid grace period", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys/${keyIdToRotate}/rotate`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          gracePeriodDays: -1,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("non-negative");
    });

    it("should reject rotation without authentication", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys/${keyIdToRotate}/rotate`)
        .send({})
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/merchants/:merchantId/api-keys/:keyId/usage", () => {
    let keyIdForUsage: string;

    beforeEach(async () => {
      // Create a test API key
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "Key for Usage",
          environment: "production",
        });

      keyIdForUsage = response.body.data.keyId;

      // Simulate some usage
      const apiKeyUsageRepo = (await import("../repositories/ApiKeyUsageRepository")).getApiKeyUsageRepository();
      await apiKeyUsageRepo.create({
        keyId: keyIdForUsage,
        merchantId: testMerchantId,
        endpoint: "/api/chat",
        method: "POST",
        statusCode: 200,
        responseTimeMs: 150,
      });
      await apiKeyUsageRepo.create({
        keyId: keyIdForUsage,
        merchantId: testMerchantId,
        endpoint: "/api/documents",
        method: "GET",
        statusCode: 200,
        responseTimeMs: 80,
      });
    });

    it("should successfully get API key usage statistics", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys/${keyIdForUsage}/usage`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("keyId", keyIdForUsage);
      expect(response.body.data).toHaveProperty("usage");
      expect(response.body.data).toHaveProperty("period");

      const usage = response.body.data.usage;
      expect(usage).toHaveProperty("totalRequests");
      expect(usage).toHaveProperty("requestsByEndpoint");
      expect(usage).toHaveProperty("requestsByStatus");
      expect(usage).toHaveProperty("avgResponseTime");
      expect(usage).toHaveProperty("lastUsed");
    });

    it("should accept custom date range", async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys/${keyIdForUsage}/usage`)
        .query({ startDate, endDate })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toHaveProperty("startDate");
      expect(response.body.data.period).toHaveProperty("endDate");
    });

    it("should reject invalid startDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys/${keyIdForUsage}/usage`)
        .query({ startDate: "invalid-date" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid startDate");
    });

    it("should reject invalid endDate", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys/${keyIdForUsage}/usage`)
        .query({ endDate: "invalid-date" })
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid endDate");
    });

    it("should reject usage request without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys/${keyIdForUsage}/usage`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("End-to-End API Key Flow", () => {
    it("should complete full API key lifecycle", async () => {
      // Step 1: Create API key
      const createResponse = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          name: "E2E Test Key",
          environment: "production",
          permissions: ["chat:read", "documents:write"],
          expiresInDays: 365,
        })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      const keyId = createResponse.body.data.keyId;
      const apiKey = createResponse.body.data.key;
      expect(apiKey).toMatch(/^pk_live_/);

      // Step 2: List API keys
      const listResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(listResponse.body.success).toBe(true);
      const createdKey = listResponse.body.data.keys.find((k: any) => k.keyId === keyId);
      expect(createdKey).toBeDefined();
      expect(createdKey.name).toBe("E2E Test Key");
      expect(createdKey.status).toBe("active");

      // Step 3: Get usage statistics
      const usageResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys/${keyId}/usage`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(usageResponse.body.success).toBe(true);
      expect(usageResponse.body.data.usage.totalRequests).toBe(0); // No usage yet

      // Step 4: Rotate API key
      const rotateResponse = await request(app)
        .post(`/api/merchants/${testMerchantId}/api-keys/${keyId}/rotate`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          gracePeriodDays: 7,
        })
        .expect(201);

      expect(rotateResponse.body.success).toBe(true);
      const newKeyId = rotateResponse.body.data.keyId;
      const newApiKey = rotateResponse.body.data.key;
      expect(newKeyId).not.toBe(keyId);
      expect(newApiKey).not.toBe(apiKey);
      expect(newApiKey).toMatch(/^pk_live_/);

      // Step 5: Verify both keys exist (old one deprecated)
      const listAfterRotateResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(listAfterRotateResponse.body.success).toBe(true);
      const oldKey = listAfterRotateResponse.body.data.keys.find((k: any) => k.keyId === keyId);
      const rotatedKey = listAfterRotateResponse.body.data.keys.find((k: any) => k.keyId === newKeyId);
      expect(oldKey).toBeDefined();
      expect(oldKey.name).toContain("deprecated");
      expect(rotatedKey).toBeDefined();
      expect(rotatedKey.name).toContain("rotated");

      // Step 6: Revoke the new key
      const revokeResponse = await request(app)
        .delete(`/api/merchants/${testMerchantId}/api-keys/${newKeyId}`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(revokeResponse.body.success).toBe(true);
      expect(revokeResponse.body.data.status).toBe("revoked");

      // Step 7: Verify revoked key is not in active list
      const finalListResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(finalListResponse.body.success).toBe(true);
      const revokedKey = finalListResponse.body.data.keys.find((k: any) => k.keyId === newKeyId);
      expect(revokedKey).toBeUndefined();

      // Step 8: Verify revoked key appears with includeRevoked flag
      const revokedListResponse = await request(app)
        .get(`/api/merchants/${testMerchantId}/api-keys?includeRevoked=true`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(revokedListResponse.body.success).toBe(true);
      const revokedKeyInList = revokedListResponse.body.data.keys.find((k: any) => k.keyId === newKeyId);
      expect(revokedKeyInList).toBeDefined();
      expect(revokedKeyInList.status).toBe("revoked");
    });
  });
});
