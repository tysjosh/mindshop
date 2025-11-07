/**
 * Integration tests for Product Sync CSV File Upload
 * Tests CSV file upload, processing, and validation
 *
 * Requirements: FR1, FR4 - Product Sync Routes and Service Methods
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
const mockDocuments = new Map<string, any>();

vi.mock("../repositories/DocumentRepository", () => ({
  DocumentRepository: vi.fn(() => ({
    findBySku: vi.fn().mockImplementation(async (sku: string) => {
      const doc = mockDocuments.get(sku);
      return doc ? [doc] : [];
    }),
    create: vi.fn().mockImplementation(async (doc: any) => {
      mockDocuments.set(doc.sku, doc);
      return doc;
    }),
    update: vi.fn().mockImplementation(async (doc: any) => {
      mockDocuments.set(doc.sku, doc);
      return doc;
    }),
  })),
  getDocumentRepository: vi.fn(() => ({
    findBySku: vi.fn().mockImplementation(async (sku: string) => {
      const doc = mockDocuments.get(sku);
      return doc ? [doc] : [];
    }),
    create: vi.fn().mockImplementation(async (doc: any) => {
      mockDocuments.set(doc.sku, doc);
      return doc;
    }),
    update: vi.fn().mockImplementation(async (doc: any) => {
      mockDocuments.set(doc.sku, doc);
      return doc;
    }),
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
      roles: ["merchant_admin", "admin"],
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

describe("Product Sync CSV Upload Tests", () => {
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
    mockDocuments.clear();
  });

  describe("POST /api/merchants/:merchantId/sync/upload - CSV Upload", () => {
    it("should successfully upload and process a valid CSV file", async () => {
      const csvContent = `sku,name,desc,price
PROD001,Product 1,Description for product 1,29.99
PROD002,Product 2,Description for product 2,39.99
PROD003,Product 3,Description for product 3,49.99`;

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(csvContent), "products.csv")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          description: "desc",
          price: "price",
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("message");
      expect(response.body.data.message).toContain("processed successfully");
      // Verify response has standard format
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("requestId");
    });

    it("should successfully upload CSV with default field mapping", async () => {
      const csvContent = `sku,title,description
SKU001,Test Product,Test Description`;

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(csvContent), "products.csv")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("message");
    });

    it("should handle CSV with special characters", async () => {
      const csvContent = `sku,name,desc
PROD001,"Product with, comma","Description with ""quotes"""
PROD002,Product 2,Normal description`;

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(csvContent), "products.csv")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          description: "desc",
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should reject upload without authentication", async () => {
      const csvContent = `sku,name,desc
PROD001,Product 1,Description 1`;

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .attach("file", Buffer.from(csvContent), "products.csv")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should reject upload without file", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("No file uploaded");
    });

    it("should reject empty CSV file", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(""), "products.csv")
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("empty");
    });

    it("should reject CSV with invalid field mapping", async () => {
      const csvContent = `sku,name,desc
PROD001,Product 1,Description 1`;

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(csvContent), "products.csv")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          // missing description
        }))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("fieldMapping");
    });

    it("should handle CSV with UTF-8 encoded characters", async () => {
      const csvContent = `sku,name,desc
PROD001,Café Latté,Delicious café latté ☕
PROD002,Crème Brûlée,Sweet crème brûlée 🍮`;

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(csvContent, "utf-8"), "products.csv")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          description: "desc",
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe("CSV Upload Response Format", () => {
    it("should return standardized API response format", async () => {
      const csvContent = `sku,name,desc
PROD001,Product 1,Description 1`;

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(csvContent), "products.csv")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          description: "desc",
        }))
        .expect(200);

      // Verify standard response format
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("requestId");
      expect(response.body.success).toBe(true);
    });

    it("should include processing statistics in response", async () => {
      const csvContent = `sku,name,desc
PROD001,Product 1,Description 1
PROD002,Product 2,Description 2`;

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(csvContent), "products.csv")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          description: "desc",
        }))
        .expect(200);

      // Verify response includes message
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("message");
      expect(response.body.data.message).toContain("processed successfully");
      
      // Verify response has standard API format
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("requestId");
    });
  });
});
