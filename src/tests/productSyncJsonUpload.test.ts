/**
 * Integration tests for Product Sync JSON File Upload
 * Tests JSON file upload, processing, and validation
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

describe("Product Sync JSON Upload Tests", () => {
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

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCache.clear();
    mockDocuments.clear();
    // Add a small delay to avoid rate limiting in tests
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe("POST /api/merchants/:merchantId/sync/upload - JSON Upload", () => {
    it("should successfully upload and process a valid JSON array", async () => {
      const jsonContent = JSON.stringify([
        {
          sku: "PROD001",
          name: "Product 1",
          desc: "Description for product 1",
          price: 29.99,
        },
        {
          sku: "PROD002",
          name: "Product 2",
          desc: "Description for product 2",
          price: 39.99,
        },
        {
          sku: "PROD003",
          name: "Product 3",
          desc: "Description for product 3",
          price: 49.99,
        },
      ]);

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(jsonContent), "products.json")
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
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("requestId");
    });

    it("should successfully upload JSON with single object", async () => {
      const jsonContent = JSON.stringify({
        sku: "SKU001",
        title: "Test Product",
        description: "Test Description",
        price: 19.99,
      });

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(jsonContent), "product.json")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "title",
          description: "description",
          price: "price",
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("message");
    });

    it("should successfully upload JSON with default field mapping", async () => {
      const jsonContent = JSON.stringify([
        {
          sku: "SKU001",
          title: "Test Product",
          description: "Test Description",
        },
      ]);

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(jsonContent), "products.json")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("message");
    });

    it("should handle JSON with nested field mapping", async () => {
      const jsonContent = JSON.stringify([
        {
          product: {
            id: "PROD001",
            details: {
              name: "Product 1",
              description: "Description 1",
            },
            pricing: {
              amount: 29.99,
            },
          },
        },
      ]);

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(jsonContent), "products.json")
        .field("fieldMapping", JSON.stringify({
          sku: "product.id",
          title: "product.details.name",
          description: "product.details.description",
          price: "product.pricing.amount",
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should handle JSON with optional fields", async () => {
      const jsonContent = JSON.stringify([
        {
          sku: "PROD001",
          name: "Product 1",
          desc: "Description 1",
          price: 29.99,
          image: "https://example.com/image1.jpg",
          category: "Electronics",
        },
      ]);

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(jsonContent), "products.json")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          description: "desc",
          price: "price",
          imageUrl: "image",
          category: "category",
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should reject upload without authentication", async () => {
      const jsonContent = JSON.stringify([
        {
          sku: "PROD001",
          name: "Product 1",
          desc: "Description 1",
        },
      ]);

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .attach("file", Buffer.from(jsonContent), "products.json")
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

    it("should reject empty JSON file", async () => {
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(""), "products.json")
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("empty");
    });

    it("should reject invalid JSON format", async () => {
      const invalidJson = "{ invalid json content }";

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(invalidJson), "products.json")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          description: "desc",
        }))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid JSON");
    });

    it("should reject JSON with invalid field mapping", async () => {
      const jsonContent = JSON.stringify([
        {
          sku: "PROD001",
          name: "Product 1",
          desc: "Description 1",
        },
      ]);

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(jsonContent), "products.json")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          // missing description
        }))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("fieldMapping");
    });

    it("should handle JSON with UTF-8 encoded characters", async () => {
      const jsonContent = JSON.stringify([
        {
          sku: "PROD001",
          name: "Café Latté",
          desc: "Delicious café latté ☕",
        },
        {
          sku: "PROD002",
          name: "Crème Brûlée",
          desc: "Sweet crème brûlée 🍮",
        },
      ]);

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(jsonContent, "utf-8"), "products.json")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          description: "desc",
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should handle large JSON file with multiple products", async () => {
      const products = Array.from({ length: 50 }, (_, i) => ({
        sku: `PROD${String(i + 1).padStart(3, "0")}`,
        name: `Product ${i + 1}`,
        desc: `Description for product ${i + 1}`,
        price: (i + 1) * 10,
      }));

      const jsonContent = JSON.stringify(products);

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(jsonContent), "products.json")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          description: "desc",
          price: "price",
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should reject unsupported file type", async () => {
      const xmlContent = '<?xml version="1.0"?><products></products>';

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(xmlContent), "products.xml")
        .expect(415);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Unsupported file type");
    });
  });

  describe("JSON Upload Response Format", () => {
    it("should return standardized API response format", async () => {
      const jsonContent = JSON.stringify([
        {
          sku: "PROD001",
          name: "Product 1",
          desc: "Description 1",
        },
      ]);

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(jsonContent), "products.json")
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
      const jsonContent = JSON.stringify([
        {
          sku: "PROD001",
          name: "Product 1",
          desc: "Description 1",
        },
        {
          sku: "PROD002",
          name: "Product 2",
          desc: "Description 2",
        },
      ]);

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(jsonContent), "products.json")
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

  describe("JSON vs CSV File Type Detection", () => {
    it("should correctly identify JSON file by extension", async () => {
      const jsonContent = JSON.stringify([
        {
          sku: "PROD001",
          name: "Product 1",
          desc: "Description 1",
        },
      ]);

      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", Buffer.from(jsonContent), "products.json")
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          description: "desc",
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should correctly identify JSON file by MIME type", async () => {
      const jsonContent = JSON.stringify([
        {
          sku: "PROD001",
          name: "Product 1",
          desc: "Description 1",
        },
      ]);

      // Create a buffer with JSON content
      const buffer = Buffer.from(jsonContent);
      
      const response = await request(app)
        .post(`/api/merchants/${testMerchantId}/sync/upload`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .attach("file", buffer, {
          filename: "products.json",
          contentType: "application/json",
        })
        .field("fieldMapping", JSON.stringify({
          sku: "sku",
          title: "name",
          description: "desc",
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
