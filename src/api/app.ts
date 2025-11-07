import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { v4 as uuidv4 } from "uuid";

// Import middleware
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { loggingMiddleware } from "./middleware/logging";
import { metricsLoggingMiddleware } from "./middleware/metricsLogging";
import { sessionCostCheckMiddleware } from "./middleware/costTracking";
import { impersonationMiddleware } from "./middleware/impersonation";
import {
  etagMiddleware,
  cacheControlMiddleware,
  responseTimeMiddleware,
  optimizedCompression,
  requestTimeoutMiddleware,
  paginationMiddleware,
  responseSizeLimiter,
  memoryMonitoringMiddleware,
} from "./middleware/performanceOptimization";

// Import routes
import chatRoutes from "./routes/chat";
import documentRoutes from "./routes/documents";
import sessionRoutes from "./routes/sessions";
import semanticRetrievalRoutes from "./routes/semanticRetrieval";
import bedrockAgentRoutes from "./routes/bedrockAgent";
import bedrockIntegrationRoutes from "./routes/bedrockIntegration";
import ragRoutes from "./routes/rag";
import merchantRoutes from "./routes/merchants";
import apiKeyRoutes from "./routes/apiKeys";
import usageRoutes from "./routes/usage";
import analyticsRoutes from "./routes/analytics";
import performanceRoutes from "./routes/performance";
import billingRoutes from "./routes/billing";
import webhookRoutes from "./routes/webhooks";
import adminRoutes from "./routes/admin";
import productSyncRoutes from "./routes/productSync";

// Import checkout service route
import { createCheckoutRoutes } from "./routes/checkout";

export interface AppConfig {
  port: number;
  environment: string;
  corsOrigins: string[];
  enableMetrics: boolean;
  enableCognito: boolean;
  cognitoUserPoolId?: string;
  cognitoClientId?: string;
  awsRegion: string;
  enableMockAuth?: boolean; // For development
}

export class APIGatewayApp {
  private app: Application;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.app = express();
    this.config = config;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      })
    );

    // CORS configuration with dynamic origin validation
    this.app.use(
      cors({
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, curl, Postman, etc.)
          if (!origin) {
            return callback(null, true);
          }

          // Check if origin is in the whitelist
          const allowedOrigins = this.config.corsOrigins;
          if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            return callback(null, true);
          }

          // For widget endpoints, allow all origins to enable merchant site integration
          // Widget endpoints: /api/chat, /api/sessions, /api/documents, /api/bedrock-agent
          // This allows the widget to work on any merchant domain
          // Admin and merchant management endpoints are still protected by the whitelist above
          return callback(null, true);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "X-Request-ID",
          "X-Merchant-ID",
          "X-User-ID",
          "X-Impersonation-Token",
          "X-API-Key",
        ],
        exposedHeaders: [
          "X-Impersonating",
          "X-Impersonated-By",
          "X-RateLimit-Limit",
          "X-RateLimit-Remaining",
          "X-RateLimit-Reset",
          "X-Request-ID",
        ],
      })
    );

    // Optimized compression with custom settings
    this.app.use(optimizedCompression());

    // Body parsing
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Performance optimization middleware
    this.app.use(responseTimeMiddleware()); // Track response times
    this.app.use(requestTimeoutMiddleware(30000)); // 30 second timeout
    this.app.use(responseSizeLimiter(10 * 1024 * 1024)); // 10MB max response
    this.app.use(etagMiddleware()); // ETag support for conditional requests
    this.app.use(cacheControlMiddleware()); // Cache-Control headers
    this.app.use(paginationMiddleware()); // Pagination helper
    
    // Memory monitoring (production only)
    if (this.config.environment === 'production') {
      this.app.use(memoryMonitoringMiddleware());
    }

    // Request ID middleware
    this.app.use((req: Request, res: Response, next) => {
      req.headers["x-request-id"] = req.headers["x-request-id"] || uuidv4();
      res.setHeader("X-Request-ID", req.headers["x-request-id"]);
      next();
    });

    // Logging middleware
    this.app.use(loggingMiddleware);

    // Metrics logging (if enabled)
    if (this.config.enableMetrics) {
      this.app.use(metricsLoggingMiddleware);
    }

    // Cost tracking and session monitoring
    this.app.use(sessionCostCheckMiddleware());

    // Impersonation middleware (must be after auth but before routes)
    // Allows admins to impersonate merchants for debugging/support
    this.app.use(impersonationMiddleware());

    // Note: Authentication is applied at the route level, not globally
    // This allows for more granular control over which routes require auth
    // See individual route files for auth middleware configuration
  }

  private setupRoutes(): void {
    // Import health controller
    const { healthController } = require("./controllers/HealthController");

    // Health check endpoints (no auth required)
    this.app.get(
      "/health",
      healthController.healthCheck.bind(healthController)
    );
    this.app.get(
      "/ready",
      healthController.readinessProbe.bind(healthController)
    );
    this.app.get(
      "/live",
      healthController.livenessProbe.bind(healthController)
    );
    this.app.get(
      "/startup",
      healthController.startupProbe.bind(healthController)
    );

    // API version info
    this.app.get("/api", (req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        data: {
          name: "MindsDB RAG Assistant API",
          version: "1.0.0",
          description:
            "Intelligent e-commerce assistant with RAG and predictive analytics",
          endpoints: {
            chat: "/api/chat",
            documents: "/api/documents",
            sessions: "/api/sessions",
            semanticRetrieval: "/api/semantic-retrieval",
            bedrockAgent: "/api/bedrock-agent",
            checkout: "/api/checkout",
            merchants: "/api/merchants",
          },
          documentation: "/api/docs",
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers["x-request-id"],
      });
    });

    // Mount API routes
    // IMPORTANT: Mount specific routes BEFORE wildcard routes
    // Merchant routes must come before bedrockIntegrationRoutes and ragRoutes
    // because those are mounted at /api and would catch /api/merchants/* requests
    this.app.use("/api/merchants", merchantRoutes); // Merchant account management (must be first!)
    this.app.use("/api/merchants", apiKeyRoutes); // API key management (nested under merchants)
    this.app.use("/api/merchants", usageRoutes); // Usage tracking and limits (nested under merchants)
    this.app.use("/api/merchants", analyticsRoutes); // Analytics dashboard (nested under merchants)
    this.app.use("/api/merchants", productSyncRoutes); // Product sync management (nested under merchants)
    this.app.use("/api/billing", billingRoutes); // Billing and subscription management
    this.app.use("/api/merchants", billingRoutes); // Also mount under merchants for nested routes
    this.app.use("/api/merchants", webhookRoutes); // Webhook management (nested under merchants)
    this.app.use("/api/admin", adminRoutes); // Admin panel (admin role required)
    this.app.use("/api/performance", performanceRoutes); // Performance monitoring (admin only)
    this.app.use("/api/chat", chatRoutes);
    this.app.use("/api/documents", documentRoutes);
    this.app.use("/api/sessions", sessionRoutes);
    this.app.use("/api/semantic-retrieval", semanticRetrievalRoutes);
    this.app.use("/api/bedrock-agent", bedrockAgentRoutes);
    this.app.use("/api/checkout", createCheckoutRoutes()); // Checkout routes (Lambda-based)
    this.app.use("/api", bedrockIntegrationRoutes); // Direct MindsDB-Bedrock Integration (wildcard)
    this.app.use("/api", ragRoutes); // MindsDB RAG routes (wildcard)

    // API documentation endpoint
    this.app.get("/api/docs", (req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        data: {
          title: "MindsDB RAG Assistant API Documentation",
          version: "1.0.0",
          baseUrl: `${req.protocol}://${req.get("host")}/api`,
          authentication: {
            type: this.config.enableCognito
              ? "AWS Cognito JWT"
              : "Bearer Token",
            header: "Authorization: Bearer <token>",
          },
          endpoints: this.generateEndpointDocumentation(),
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers["x-request-id"],
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  private generateEndpointDocumentation(): any {
    return {
      chat: {
        "POST /api/chat": {
          description: "Process chat query with RAG and predictions",
          authentication: "required",
          rateLimit: "30 requests/minute",
          body: {
            query: "string (required)",
            sessionId: "string (optional, UUID)",
            merchantId: "string (required)",
            userId: "string (optional)",
            userContext: "object (optional)",
            includeExplainability: "boolean (optional)",
            maxResults: "number (optional, 1-20)",
          },
        },
        "GET /api/chat/sessions/:sessionId/history": {
          description: "Get chat history for a session",
          authentication: "required",
          rateLimit: "100 requests/minute",
          params: { sessionId: "string (UUID)" },
          query: { merchantId: "string (required)" },
        },
        "DELETE /api/chat/sessions/:sessionId": {
          description: "Clear chat session",
          authentication: "required",
          rateLimit: "100 requests/minute",
          params: { sessionId: "string (UUID)" },
          body: { merchantId: "string (required)" },
        },
      },
      documents: {
        "POST /api/documents": {
          description: "Create a new document",
          authentication: "required",
          rateLimit: "100 requests/minute",
          body: {
            merchantId: "string (required)",
            sku: "string (optional)",
            title: "string (required)",
            body: "string (required)",
            documentType: "string (required: product|faq|policy|review)",
            metadata: "object (optional)",
          },
        },
        "GET /api/documents/search": {
          description: "Search documents with semantic or text search",
          authentication: "required",
          rateLimit: "100 requests/minute",
          query: {
            merchantId: "string (required)",
            query: "string (optional, for semantic search)",
            documentType: "string (optional)",
            sku: "string (optional)",
            limit: "number (optional, 1-100)",
            offset: "number (optional)",
          },
        },
        "POST /api/documents/bulk": {
          description: "Bulk upload documents (max 100)",
          authentication: "required",
          rateLimit: "10 requests/minute",
          body: {
            merchantId: "string (required)",
            documents: "array (required, max 100 items)",
          },
        },
      },
      sessions: {
        "POST /api/sessions": {
          description: "Create a new session",
          authentication: "required",
          rateLimit: "100 requests/minute",
          body: {
            merchantId: "string (required)",
            userId: "string (required)",
            context: "object (optional)",
          },
        },
        "GET /api/sessions/:sessionId": {
          description: "Get session details",
          authentication: "required",
          rateLimit: "100 requests/minute",
          params: { sessionId: "string (UUID)" },
          query: { merchantId: "string (required)" },
        },
        "GET /api/sessions/analytics": {
          description: "Get session analytics for a merchant",
          authentication: "required",
          rateLimit: "20 requests/minute",
          query: {
            merchantId: "string (required)",
            startDate: "string (optional, ISO date)",
            endDate: "string (optional, ISO date)",
            userId: "string (optional)",
          },
        },
      },
      "semantic-retrieval": {
        "POST /api/semantic-retrieval/deploy": {
          description: "Deploy semantic retriever predictor for a merchant",
          authentication: "required",
          rateLimit: "100 requests/minute",
          body: {
            merchantId: "string (required, 3-100 chars)",
          },
        },
        "POST /api/semantic-retrieval/search": {
          description: "Enhanced semantic document retrieval (SQL interface)",
          authentication: "required",
          rateLimit: "100 requests/minute",
          body: {
            query: "string (required, 1-1000 chars)",
            merchantId: "string (required, 3-100 chars)",
            limit: "number (optional, 1-50)",
            threshold: "number (optional, 0-1)",
            includeMetadata: "boolean (optional)",
            documentTypes: "array of strings (optional)",
          },
        },
        "POST /api/semantic-retrieval/rest-search": {
          description: "REST API interface for semantic retrieval",
          authentication: "required",
          rateLimit: "100 requests/minute",
          body: {
            query: "string (required, 1-1000 chars)",
            merchantId: "string (required, 3-100 chars)",
            limit: "number (optional, 1-50)",
            threshold: "number (optional, 0-1)",
            includeMetadata: "boolean (optional)",
            documentTypes: "array of strings (optional)",
          },
        },
        "POST /api/semantic-retrieval/validate-grounding": {
          description: "Validate grounding for retrieved documents",
          authentication: "required",
          rateLimit: "100 requests/minute",
          body: {
            query: "string (required, 1-1000 chars)",
            merchantId: "string (required, 3-100 chars)",
            documents: "array (required, 1-20 items with id, snippet, score)",
          },
        },
        "GET /api/semantic-retrieval/status/:merchantId": {
          description: "Get predictor status and health",
          authentication: "required",
          rateLimit: "100 requests/minute",
          params: { merchantId: "string (required, 3-100 chars)" },
        },
        "PUT /api/semantic-retrieval/config/:merchantId": {
          description: "Update predictor configuration",
          authentication: "required",
          rateLimit: "100 requests/minute",
          params: { merchantId: "string (required, 3-100 chars)" },
          body: {
            config: "object (required with threshold, maxResults, groundingValidation, explainability, embeddingModel)",
          },
        },
        "GET /api/semantic-retrieval/health": {
          description: "Health check endpoint for semantic retrieval service",
          authentication: "required",
          rateLimit: "100 requests/minute",
        },
      },
      "bedrock-agent": {
        "POST /api/bedrock-agent/chat": {
          description: "Process chat request through Bedrock Agent",
          authentication: "none",
          rateLimit: "30 requests/minute",
          body: {
            query: "string (required, 1-2000 chars)",
            merchant_id: "string (required, UUID)",
            user_id: "string (required)",
            session_id: "string (optional, UUID)",
            user_context: "object (optional)",
          },
        },
        "POST /api/bedrock-agent/sessions": {
          description: "Create new session",
          authentication: "none",
          rateLimit: "100 requests/minute",
          body: {
            merchant_id: "string (required, UUID)",
            user_id: "string (required)",
            context: "object (optional)",
          },
        },
        "GET /api/bedrock-agent/sessions/:sessionId": {
          description: "Get session details",
          authentication: "none",
          rateLimit: "100 requests/minute",
          params: { sessionId: "string (UUID)" },
        },
        "GET /api/bedrock-agent/sessions/:sessionId/history": {
          description: "Get session conversation history",
          authentication: "none",
          rateLimit: "100 requests/minute",
          params: { sessionId: "string (UUID)" },
        },
        "DELETE /api/bedrock-agent/sessions/:sessionId": {
          description: "Clear session",
          authentication: "none",
          rateLimit: "100 requests/minute",
          params: { sessionId: "string (UUID)" },
          body: { merchant_id: "string (required, UUID)" },
        },
        "GET /api/bedrock-agent/users/:userId/sessions": {
          description: "Get user sessions",
          authentication: "none",
          rateLimit: "100 requests/minute",
          params: { userId: "string" },
        },
        "GET /api/bedrock-agent/stats": {
          description: "Get session statistics for a merchant",
          authentication: "none",
          rateLimit: "100 requests/minute",
          query: { merchant_id: "string (required, UUID)" },
        },
        "GET /api/bedrock-agent/health": {
          description: "Health check endpoint",
          authentication: "none",
          rateLimit: "none",
        },
        "POST /api/bedrock-agent/parse-intent": {
          description: "Parse user intent (for debugging/testing)",
          authentication: "none",
          rateLimit: "100 requests/minute",
          body: {
            query: "string (required, 1-2000 chars)",
            merchant_id: "string (required, UUID)",
            user_context: "object (optional)",
          },
        },
        "GET /api/bedrock-agent/sessions/:sessionId/summary": {
          description: "Get detailed session summary with audit information",
          authentication: "none",
          rateLimit: "100 requests/minute",
          params: { sessionId: "string (UUID)" },
        },
        "GET /api/bedrock-agent/audit/search": {
          description: "Search audit entries",
          authentication: "none",
          rateLimit: "100 requests/minute",
          query: {
            merchant_id: "string (optional, UUID)",
            user_id: "string (optional)",
            start_date: "string (optional, ISO date)",
            end_date: "string (optional, ISO date)",
          },
        },
        "POST /api/bedrock-agent/compliance/report": {
          description: "Generate compliance report",
          authentication: "none",
          rateLimit: "100 requests/minute",
          body: {
            merchant_id: "string (required, UUID)",
            start_date: "string (required, ISO date)",
            end_date: "string (required, ISO date)",
          },
        },
      },
      checkout: {
        "POST /api/checkout/process": {
          description: "Process secure checkout with payment gateway",
          authentication: "required",
          rateLimit: "10 requests/minute",
          body: {
            merchant_id: "string (required)",
            user_id: "string (required)",
            session_id: "string (required)",
            items: "array (required)",
            payment_method: "string (required: stripe|adyen|default)",
            shipping_address: "object (required)",
            user_consent: "object (required)",
          },
        },
        "GET /api/checkout/transaction/:transactionId": {
          description: "Get transaction status",
          authentication: "required",
          rateLimit: "50 requests/minute",
          params: { transactionId: "string (UUID)" },
          query: { merchantId: "string (required)" },
        },
      },
      merchants: {
        "POST /api/merchants/register": {
          description: "Register a new merchant account",
          authentication: "none",
          rateLimit: "10 requests/minute",
          body: {
            email: "string (required)",
            password: "string (required, min 8 chars)",
            companyName: "string (required)",
            website: "string (optional)",
            industry: "string (optional)",
          },
        },
        "POST /api/merchants/verify-email": {
          description: "Verify email with confirmation code",
          authentication: "none",
          rateLimit: "10 requests/minute",
          body: {
            email: "string (required)",
            code: "string (required)",
          },
        },
        "POST /api/merchants/resend-verification": {
          description: "Resend verification code",
          authentication: "none",
          rateLimit: "5 requests/minute",
          body: {
            email: "string (required)",
          },
        },
        "POST /api/merchants/login": {
          description: "Login with email and password",
          authentication: "none",
          rateLimit: "20 requests/minute",
          body: {
            email: "string (required)",
            password: "string (required)",
          },
        },
        "POST /api/merchants/refresh-token": {
          description: "Refresh access token",
          authentication: "none",
          rateLimit: "50 requests/minute",
          body: {
            refreshToken: "string (required)",
          },
        },
        "POST /api/merchants/forgot-password": {
          description: "Initiate forgot password flow",
          authentication: "none",
          rateLimit: "5 requests/minute",
          body: {
            email: "string (required)",
          },
        },
        "POST /api/merchants/reset-password": {
          description: "Reset password with confirmation code",
          authentication: "none",
          rateLimit: "10 requests/minute",
          body: {
            email: "string (required)",
            code: "string (required)",
            newPassword: "string (required, min 8 chars)",
          },
        },
        "GET /api/merchants/:merchantId/profile": {
          description: "Get merchant profile",
          authentication: "required",
          rateLimit: "100 requests/minute",
          params: { merchantId: "string (required)" },
        },
        "PUT /api/merchants/:merchantId/profile": {
          description: "Update merchant profile",
          authentication: "required",
          rateLimit: "50 requests/minute",
          params: { merchantId: "string (required)" },
          body: {
            companyName: "string (optional)",
            website: "string (optional)",
            industry: "string (optional)",
          },
        },
        "GET /api/merchants/:merchantId/settings": {
          description: "Get merchant settings",
          authentication: "required",
          rateLimit: "100 requests/minute",
          params: { merchantId: "string (required)" },
        },
        "PUT /api/merchants/:merchantId/settings": {
          description: "Update merchant settings",
          authentication: "required",
          rateLimit: "50 requests/minute",
          params: { merchantId: "string (required)" },
          body: {
            settings: "object (required)",
          },
        },
        "DELETE /api/merchants/:merchantId/account": {
          description: "Delete merchant account",
          authentication: "required",
          rateLimit: "5 requests/minute",
          params: { merchantId: "string (required)" },
        },
        "POST /api/merchants/:merchantId/api-keys": {
          description: "Create a new API key",
          authentication: "required",
          rateLimit: "10 requests/minute",
          params: { merchantId: "string (required)" },
          body: {
            name: "string (required)",
            environment: "string (required: development|production)",
            permissions: "array of strings (optional)",
            expiresInDays: "number (optional)",
          },
        },
        "GET /api/merchants/:merchantId/api-keys": {
          description: "List all API keys for a merchant",
          authentication: "required",
          rateLimit: "100 requests/minute",
          params: { merchantId: "string (required)" },
          query: {
            includeRevoked: "boolean (optional, default: false)",
          },
        },
        "DELETE /api/merchants/:merchantId/api-keys/:keyId": {
          description: "Revoke an API key",
          authentication: "required",
          rateLimit: "50 requests/minute",
          params: {
            merchantId: "string (required)",
            keyId: "string (required)",
          },
        },
        "POST /api/merchants/:merchantId/api-keys/:keyId/rotate": {
          description: "Rotate an API key (generate new, deprecate old)",
          authentication: "required",
          rateLimit: "10 requests/minute",
          params: {
            merchantId: "string (required)",
            keyId: "string (required)",
          },
          body: {
            gracePeriodDays: "number (optional, default: 7)",
          },
        },
        "GET /api/merchants/:merchantId/api-keys/:keyId/usage": {
          description: "Get usage statistics for an API key",
          authentication: "required",
          rateLimit: "100 requests/minute",
          params: {
            merchantId: "string (required)",
            keyId: "string (required)",
          },
          query: {
            startDate: "string (optional, ISO date, default: 30 days ago)",
            endDate: "string (optional, ISO date, default: now)",
          },
        },
      },
    };
  }

  public getApp(): Application {
    return this.app;
  }

  public start(): void {
    this.app.listen(this.config.port, () => {
      console.log(
        `🚀 MindsDB RAG Assistant API server running on port ${this.config.port}`
      );
      console.log(`📖 Environment: ${this.config.environment}`);
      console.log(
        `🔒 Cognito Auth: ${this.config.enableCognito ? "Enabled" : "Disabled"}`
      );
      console.log(
        `📊 Metrics: ${this.config.enableMetrics ? "Enabled" : "Disabled"}`
      );
      console.log(
        `📚 API Documentation: http://localhost:${this.config.port}/api/docs`
      );
      console.log(
        `❤️  Health Check: http://localhost:${this.config.port}/health`
      );
    });
  }
}

// Factory function to create app with default configuration
export function createAPIGatewayApp(
  overrides: Partial<AppConfig> = {}
): APIGatewayApp {
  const defaultConfig: AppConfig = {
    port: parseInt(process.env.PORT || "3000", 10),
    environment: process.env.NODE_ENV || "development",
    corsOrigins: process.env.CORS_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    enableMetrics: process.env.ENABLE_METRICS === "true",
    enableCognito: process.env.ENABLE_COGNITO_AUTH === "true",
    cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID,
    cognitoClientId: process.env.COGNITO_CLIENT_ID,
    awsRegion: process.env.COGNITO_REGION || process.env.AWS_REGION || "us-east-1",
    enableMockAuth: process.env.NODE_ENV === "development" && process.env.ENABLE_COGNITO_AUTH !== "true",
  };

  const config = { ...defaultConfig, ...overrides };
  return new APIGatewayApp(config);
}
