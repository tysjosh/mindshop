/**
 * Integration tests for Merchant Platform API Endpoints
 * Tests merchant registration, authentication, profile management, and settings
 *
 * Requirements: 1.1, 1.2, 2.1, 2.2
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

vi.mock("../api/controllers/HealthController", () => ({
  healthController: {
    healthCheck: vi.fn((req: any, res: any) => {
      res.status(200).json({ status: "ok" });
    }),
    readinessProbe: vi.fn((req: any, res: any) => {
      res.status(200).json({ status: "ready" });
    }),
    livenessProbe: vi.fn((req: any, res: any) => {
      res.status(200).json({ status: "alive" });
    }),
    startupProbe: vi.fn((req: any, res: any) => {
      res.status(200).json({ status: "started" });
    }),
  },
  HealthController: vi.fn(),
}));

// Mock database repositories to avoid actual database calls
const merchantStore = new Map<string, any>();

vi.mock("../repositories/MerchantRepository", () => ({
  getMerchantRepository: vi.fn(() => ({
    findByEmail: vi.fn().mockImplementation((email: string) => {
      const merchant = merchantStore.get(email);
      return Promise.resolve(merchant || null);
    }),
    findByMerchantId: vi.fn().mockImplementation((merchantId: string) => {
      // Find merchant by merchantId in the store
      for (const [email, merchant] of merchantStore.entries()) {
        if (merchant.merchantId === merchantId) {
          return Promise.resolve(merchant);
        }
      }
      return Promise.resolve({
        merchantId: merchantId,
        email: "test@example.com",
        companyName: "Test Company",
        status: "active",
        plan: "starter",
        createdAt: new Date(),
      });
    }),
    create: vi.fn().mockImplementation((data: any) => {
      const merchant = {
        merchantId: data.merchantId || "test_merchant_123",
        email: data.email,
        companyName: data.companyName,
        status: data.status || "pending_verification",
        plan: "starter",
        createdAt: new Date(),
      };
      merchantStore.set(data.email, merchant);
      return Promise.resolve(merchant);
    }),
    update: vi.fn().mockImplementation((merchantId: string, data: any) => {
      // Find and update merchant in store
      for (const [email, merchant] of merchantStore.entries()) {
        if (merchant.merchantId === merchantId) {
          const updated = { ...merchant, ...data, updatedAt: new Date() };
          merchantStore.set(email, updated);
          return Promise.resolve(updated);
        }
      }
      return Promise.resolve({
        merchantId: merchantId,
        email: "test@example.com",
        companyName: data.companyName || "Updated Company",
        status: data.status || "active",
        plan: "starter",
      });
    }),
    markAsVerified: vi.fn().mockImplementation((email: string) => {
      const merchant = merchantStore.get(email);
      if (merchant) {
        merchant.status = "active";
        merchant.verifiedAt = new Date();
        merchantStore.set(email, merchant);
        return Promise.resolve(merchant);
      }
      return Promise.resolve({
        merchantId: "test_merchant_123",
        email: email,
        companyName: "Test Company",
        status: "active",
        verifiedAt: new Date(),
        plan: "starter",
        createdAt: new Date(),
      });
    }),
  })),
}));

vi.mock("../repositories/MerchantSettingsRepository", () => ({
  getMerchantSettingsRepository: vi.fn(() => ({
    findByMerchantId: vi.fn().mockResolvedValue({
      merchantId: "test_merchant_123",
      settings: {
        widget: { theme: { primaryColor: "#007bff" } },
        rag: { maxResults: 5 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    create: vi.fn().mockResolvedValue({
      merchantId: "test_merchant_123",
      settings: {},
    }),
    update: vi.fn().mockResolvedValue({
      merchantId: "test_merchant_123",
      settings: {},
    }),
    updatePartial: vi.fn().mockResolvedValue({
      merchantId: "test_merchant_123",
      settings: {},
    }),
  })),
}));

// Mock JWT authentication middleware
vi.mock("../api/middleware/auth", () => ({
  authenticateJWT: vi.fn(() => (req: any, res: any, next: any) => {
    // Check if Authorization header is present
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
import merchantRoutes from "../api/routes/merchants";
import { getMerchantService } from "../services/MerchantService";
import { getMerchantRepository } from "../repositories/MerchantRepository";
import { getMerchantSettingsRepository } from "../repositories/MerchantSettingsRepository";

// Mock AWS SDK Cognito
vi.mock("@aws-sdk/client-cognito-identity-provider", () => {
  return {
    CognitoIdentityProviderClient: vi.fn(() => ({
      send: vi.fn().mockImplementation((command: any) => {
        const commandName = command.constructor.name;
        
        if (commandName === "SignUpCommand") {
          return Promise.resolve({ UserSub: "test-user-sub-123" });
        }
        if (commandName === "ConfirmSignUpCommand") {
          return Promise.resolve({});
        }
        if (commandName === "InitiateAuthCommand") {
          return Promise.resolve({
            AuthenticationResult: {
              AccessToken: "mock-access-token-123",
              IdToken: "mock-id-token-123",
              RefreshToken: "mock-refresh-token-123",
              ExpiresIn: 3600,
            },
          });
        }
        if (commandName === "AdminGetUserCommand") {
          return Promise.resolve({
            Username: "test@example.com",
            UserStatus: "CONFIRMED",
            UserAttributes: [
              { Name: "email", Value: "test@example.com" },
              { Name: "custom:merchant_id", Value: "test_merchant_123" },
            ],
          });
        }
        if (commandName === "ResendConfirmationCodeCommand") {
          return Promise.resolve({});
        }
        if (commandName === "ForgotPasswordCommand") {
          return Promise.resolve({});
        }
        if (commandName === "ConfirmForgotPasswordCommand") {
          return Promise.resolve({});
        }
        if (commandName === "AdminUpdateUserAttributesCommand") {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      }),
    })),
    SignUpCommand: vi.fn((params) => ({ constructor: { name: "SignUpCommand" }, ...params })),
    ConfirmSignUpCommand: vi.fn((params) => ({ constructor: { name: "ConfirmSignUpCommand" }, ...params })),
    InitiateAuthCommand: vi.fn((params) => ({ constructor: { name: "InitiateAuthCommand" }, ...params })),
    ForgotPasswordCommand: vi.fn((params) => ({ constructor: { name: "ForgotPasswordCommand" }, ...params })),
    ConfirmForgotPasswordCommand: vi.fn((params) => ({ constructor: { name: "ConfirmForgotPasswordCommand" }, ...params })),
    AdminGetUserCommand: vi.fn((params) => ({ constructor: { name: "AdminGetUserCommand" }, ...params })),
    AdminUpdateUserAttributesCommand: vi.fn((params) => ({ constructor: { name: "AdminUpdateUserAttributesCommand" }, ...params })),
    ResendConfirmationCodeCommand: vi.fn((params) => ({ constructor: { name: "ResendConfirmationCodeCommand" }, ...params })),
  };
});

describe("Merchant Integration Tests", () => {
  let app: Application;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "TestPass123!";
  const testCompanyName = "Test Company Inc";
  let testMerchantId: string;
  let testAccessToken: string;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = "test";
    process.env.ENABLE_COGNITO_AUTH = "false"; // Use mock auth for testing
    process.env.COGNITO_CLIENT_ID = "test-client-id";
    process.env.COGNITO_USER_POOL_ID = "test-user-pool-id";
    process.env.COGNITO_REGION = "us-east-1";

    // Create minimal Express app for testing
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.headers["x-request-id"] = req.headers["x-request-id"] || "test-request-id";
      next();
    });
    app.use("/api/merchants", merchantRoutes);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/merchants/register", () => {
    it("should successfully register a new merchant", async () => {
      const response = await request(app)
        .post("/api/merchants/register")
        .send({
          email: testEmail,
          password: testPassword,
          companyName: testCompanyName,
          website: "https://testcompany.com",
          industry: "E-commerce",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId");
      expect(response.body.data).toHaveProperty("email", testEmail);
      expect(response.body.data).toHaveProperty("message");
      expect(response.body.data.message).toContain("verification");

      testMerchantId = response.body.data.merchantId;
    });

    it("should reject registration with invalid email", async () => {
      const response = await request(app)
        .post("/api/merchants/register")
        .send({
          email: "invalid-email",
          password: testPassword,
          companyName: testCompanyName,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should reject registration with weak password", async () => {
      const response = await request(app)
        .post("/api/merchants/register")
        .send({
          email: `weak-${Date.now()}@example.com`,
          password: "weak",
          companyName: testCompanyName,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should reject registration with missing required fields", async () => {
      const response = await request(app)
        .post("/api/merchants/register")
        .send({
          email: testEmail,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/merchants/verify-email", () => {
    it("should successfully verify email with valid code", async () => {
      // First register to get a valid email
      const registerResponse = await request(app)
        .post("/api/merchants/register")
        .send({
          email: `verify-${Date.now()}@example.com`,
          password: testPassword,
          companyName: "Verify Test Company",
        });

      const email = registerResponse.body.data.email;

      const response = await request(app)
        .post("/api/merchants/verify-email")
        .send({
          email: email,
          confirmationCode: "123456",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("message");
      expect(response.body.data.message).toContain("verified");
    });

    it("should reject verification with missing email", async () => {
      const response = await request(app)
        .post("/api/merchants/verify-email")
        .send({
          confirmationCode: "123456",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject verification with missing code", async () => {
      const response = await request(app)
        .post("/api/merchants/verify-email")
        .send({
          email: testEmail,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/merchants/resend-verification", () => {
    it("should successfully resend verification code", async () => {
      const response = await request(app)
        .post("/api/merchants/resend-verification")
        .send({
          email: testEmail,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("message");
      expect(response.body.data.message).toContain("Verification code sent");
    });

    it("should reject resend with missing email", async () => {
      const response = await request(app)
        .post("/api/merchants/resend-verification")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/merchants/login", () => {
    it("should successfully login with valid credentials", async () => {
      // First register and verify
      const uniqueEmail = `login-${Date.now()}@example.com`;
      await request(app)
        .post("/api/merchants/register")
        .send({
          email: uniqueEmail,
          password: testPassword,
          companyName: "Login Test Company",
        });

      const response = await request(app)
        .post("/api/merchants/login")
        .send({
          email: uniqueEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("idToken");
      expect(response.body.data).toHaveProperty("refreshToken");
      expect(response.body.data).toHaveProperty("expiresIn");
      expect(response.body.data).toHaveProperty("merchantId");

      testAccessToken = response.body.data.accessToken;
    });

    it("should reject login with missing email", async () => {
      const response = await request(app)
        .post("/api/merchants/login")
        .send({
          password: testPassword,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject login with missing password", async () => {
      const response = await request(app)
        .post("/api/merchants/login")
        .send({
          email: testEmail,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/merchants/refresh-token", () => {
    it("should successfully refresh access token", async () => {
      const response = await request(app)
        .post("/api/merchants/refresh-token")
        .send({
          refreshToken: "mock-refresh-token-123",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("idToken");
      expect(response.body.data).toHaveProperty("expiresIn");
    });

    it("should reject refresh with missing token", async () => {
      const response = await request(app)
        .post("/api/merchants/refresh-token")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/merchants/forgot-password", () => {
    it("should successfully initiate forgot password flow", async () => {
      const response = await request(app)
        .post("/api/merchants/forgot-password")
        .send({
          email: testEmail,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("message");
      expect(response.body.data.message).toContain("reset code sent");
    });

    it("should reject forgot password with missing email", async () => {
      const response = await request(app)
        .post("/api/merchants/forgot-password")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/merchants/reset-password", () => {
    it("should successfully reset password with valid code", async () => {
      const response = await request(app)
        .post("/api/merchants/reset-password")
        .send({
          email: testEmail,
          confirmationCode: "123456",
          newPassword: "NewPass123!",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("message");
      expect(response.body.data.message).toContain("reset successful");
    });

    it("should reject reset with weak password", async () => {
      const response = await request(app)
        .post("/api/merchants/reset-password")
        .send({
          email: testEmail,
          confirmationCode: "123456",
          newPassword: "weak",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should reject reset with missing fields", async () => {
      const response = await request(app)
        .post("/api/merchants/reset-password")
        .send({
          email: testEmail,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/merchants/:merchantId/profile", () => {
    it("should successfully get merchant profile with valid auth", async () => {
      // First register and login to get a valid merchant ID
      const registerResponse = await request(app)
        .post("/api/merchants/register")
        .send({
          email: `profile-${Date.now()}@example.com`,
          password: testPassword,
          companyName: "Profile Test Company",
        });

      const merchantId = registerResponse.body.data.merchantId;

      // Mock JWT verification to return the merchant ID
      const response = await request(app)
        .get(`/api/merchants/${merchantId}/profile`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId");
      expect(response.body.data).toHaveProperty("email");
      expect(response.body.data).toHaveProperty("companyName");
    });

    it("should reject profile access without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/test_merchant_123/profile`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/merchants/:merchantId/profile", () => {
    it("should successfully update merchant profile", async () => {
      // First register to get a valid merchant ID
      const registerResponse = await request(app)
        .post("/api/merchants/register")
        .send({
          email: `update-${Date.now()}@example.com`,
          password: testPassword,
          companyName: "Update Test Company",
        });

      const merchantId = registerResponse.body.data.merchantId;

      const response = await request(app)
        .put(`/api/merchants/${merchantId}/profile`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          companyName: "Updated Company Name",
          website: "https://updated.com",
          industry: "Technology",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId");
    });

    it("should reject profile update without authentication", async () => {
      const response = await request(app)
        .put(`/api/merchants/test_merchant_123/profile`)
        .send({
          companyName: "Updated Company",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/merchants/:merchantId/settings", () => {
    it("should successfully get merchant settings", async () => {
      // First register to get a valid merchant ID
      const registerResponse = await request(app)
        .post("/api/merchants/register")
        .send({
          email: `settings-${Date.now()}@example.com`,
          password: testPassword,
          companyName: "Settings Test Company",
        });

      const merchantId = registerResponse.body.data.merchantId;

      const response = await request(app)
        .get(`/api/merchants/${merchantId}/settings`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId");
      expect(response.body.data).toHaveProperty("settings");
      expect(response.body.data.settings).toHaveProperty("widget");
      expect(response.body.data.settings).toHaveProperty("rag");
    });

    it("should reject settings access without authentication", async () => {
      const response = await request(app)
        .get(`/api/merchants/test_merchant_123/settings`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/merchants/:merchantId/settings", () => {
    it("should successfully update merchant settings", async () => {
      // First register to get a valid merchant ID
      const registerResponse = await request(app)
        .post("/api/merchants/register")
        .send({
          email: `settings-update-${Date.now()}@example.com`,
          password: testPassword,
          companyName: "Settings Update Test Company",
        });

      const merchantId = registerResponse.body.data.merchantId;

      const response = await request(app)
        .put(`/api/merchants/${merchantId}/settings`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          settings: {
            widget: {
              theme: {
                primaryColor: "#FF5733",
                position: "bottom-left",
              },
            },
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("merchantId");
      expect(response.body.data).toHaveProperty("settings");
    });

    it("should reject settings update with invalid data", async () => {
      const response = await request(app)
        .put(`/api/merchants/test-merchant-123/settings`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .send({
          settings: "invalid",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject settings update without authentication", async () => {
      const response = await request(app)
        .put(`/api/merchants/test_merchant_123/settings`)
        .send({
          settings: {},
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("DELETE /api/merchants/:merchantId/account", () => {
    it("should successfully delete merchant account", async () => {
      // First register to get a valid merchant ID
      const registerResponse = await request(app)
        .post("/api/merchants/register")
        .send({
          email: `delete-${Date.now()}@example.com`,
          password: testPassword,
          companyName: "Delete Test Company",
        });

      const merchantId = registerResponse.body.data.merchantId;

      const response = await request(app)
        .delete(`/api/merchants/${merchantId}/account`)
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should reject account deletion without authentication", async () => {
      const response = await request(app)
        .delete(`/api/merchants/test_merchant_123/account`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("End-to-End Merchant Flow", () => {
    it("should complete full merchant registration and login flow", async () => {
      const uniqueEmail = `e2e-${Date.now()}@example.com`;

      // Step 1: Register
      const registerResponse = await request(app)
        .post("/api/merchants/register")
        .send({
          email: uniqueEmail,
          password: testPassword,
          companyName: "E2E Test Company",
          website: "https://e2e-test.com",
          industry: "Retail",
        })
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      const merchantId = registerResponse.body.data.merchantId;

      // Step 2: Verify Email
      const verifyResponse = await request(app)
        .post("/api/merchants/verify-email")
        .send({
          email: uniqueEmail,
          confirmationCode: "123456",
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);

      // Step 3: Login
      const loginResponse = await request(app)
        .post("/api/merchants/login")
        .send({
          email: uniqueEmail,
          password: testPassword,
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data).toHaveProperty("accessToken");
      const accessToken = loginResponse.body.data.accessToken;

      // Step 4: Get Profile
      const profileResponse = await request(app)
        .get(`/api/merchants/${merchantId}/profile`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.email).toBe(uniqueEmail);

      // Step 5: Update Profile
      const updateResponse = await request(app)
        .put(`/api/merchants/${merchantId}/profile`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          companyName: "E2E Updated Company",
          website: "https://e2e-updated.com",
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);

      // Step 6: Get Settings
      const settingsResponse = await request(app)
        .get(`/api/merchants/${merchantId}/settings`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(settingsResponse.body.success).toBe(true);
      expect(settingsResponse.body.data.settings).toHaveProperty("widget");

      // Step 7: Update Settings
      const updateSettingsResponse = await request(app)
        .put(`/api/merchants/${merchantId}/settings`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          settings: {
            widget: {
              theme: {
                primaryColor: "#00FF00",
              },
            },
          },
        })
        .expect(200);

      expect(updateSettingsResponse.body.success).toBe(true);
    });
  });
});
