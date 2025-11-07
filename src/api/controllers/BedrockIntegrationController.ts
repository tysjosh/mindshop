import { Request, Response } from "express";
import { MindsDBService } from "../../services/MindsDBService";
import { RAGService } from "../../services/RAGService";
import { PredictionService } from "../../services/PredictionService";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { ApiResponse } from "../../types";

export class BedrockIntegrationController {
  private mindsdbService: MindsDBService;
  private ragService: RAGService;
  private predictionService: PredictionService;
  private secretsManager: SecretsManagerClient;

  constructor() {
    this.mindsdbService = new MindsDBService();
    this.ragService = new RAGService();
    this.predictionService = new PredictionService(this.mindsdbService);
    this.secretsManager = new SecretsManagerClient({
      region: process.env.AWS_REGION || "us-east-2",
    });
  }

  /**
   * Retrieve stored AWS credentials for a merchant from AWS Secrets Manager
   */
  private async getStoredCredentials(
    merchantId: string,
    credentialId: string
  ): Promise<any> {
    try {
      const secretName = `mindsdb-rag/merchants/${merchantId}/aws-credentials/${credentialId}`;
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.secretsManager.send(command);

      if (!response.SecretString) {
        throw new Error("Secret value is empty");
      }

      const credentials = JSON.parse(response.SecretString);
      return {
        accessKeyId: credentials.awsAccessKeyId,
        secretAccessKey: credentials.awsSecretAccessKey,
        region: credentials.awsRegion || "us-east-2",
      };
    } catch (error) {
      console.error(
        `Failed to retrieve credentials for merchant ${merchantId}:`,
        error
      );
      throw new Error(
        `Credential retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Initialize Bedrock integration for a merchant
   * Supports multiple credential sources for multi-tenant deployments
   */
  async initializeBedrockIntegration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { merchantId } = req.params;
      const {
        // Option 1: Direct credentials (for merchant-specific AWS accounts)
        awsAccessKeyId,
        awsSecretAccessKey,

        // Option 2: Credential reference (for secure storage)
        credentialId,

        // Option 3: Use service defaults (for single AWS account)
        useServiceDefaults = false,

        // Configuration
        awsRegion = "us-east-2",
        modelId = "amazon.nova-micro-v1:0",
        mode = "default",
        maxTokens = 4096,
        temperature = 0.7,
      } = req.body;

      if (!merchantId) {
        const response: ApiResponse = {
          success: false,
          error: "Missing required parameter: merchantId",
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      let credentials: any = {};

      // Determine credential source
      if (awsAccessKeyId && awsSecretAccessKey) {
        // Option 1: Direct credentials from request
        credentials = {
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
          region: awsRegion,
        };
        console.log(`Using direct credentials for merchant: ${merchantId}`);
      } else if (credentialId) {
        // Option 2: Retrieve from secure storage (AWS Secrets Manager)
        try {
          credentials = await this.getStoredCredentials(
            merchantId,
            credentialId
          );
          console.log(`Using stored credentials for merchant: ${merchantId}`);
        } catch (error) {
          const response: ApiResponse = {
            success: false,
            error: "Failed to retrieve stored credentials",
            message: `Credential ID '${credentialId}' not found or inaccessible`,
            details: { credentialId },
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string || 'unknown',
          };
          res.status(400).json(response);
          return;
        }
      } else if (useServiceDefaults || process.env.NODE_ENV === "development") {
        // Option 3: Use service defaults (development or single-tenant)
        credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region:
            process.env.AWS_REGION || process.env.BEDROCK_REGION || awsRegion,
        };

        if (!credentials.accessKeyId || !credentials.secretAccessKey) {
          const response: ApiResponse = {
            success: false,
            error: "Missing AWS credentials",
            message:
              "Provide credentials via: 1) Request body (awsAccessKeyId, awsSecretAccessKey), 2) Credential reference (credentialId), or 3) Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)",
            details: {
              options: {
                directCredentials:
                  "Include awsAccessKeyId and awsSecretAccessKey in request body",
                storedCredentials:
                  "Include credentialId referencing stored credentials",
                serviceDefaults:
                  "Set useServiceDefaults: true and configure environment variables",
              },
            },
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string || 'unknown',
          };
          res.status(400).json(response);
          return;
        }
        console.log(
          `Using service default credentials for merchant: ${merchantId}`
        );
      } else {
        const response: ApiResponse = {
          success: false,
          error: "No AWS credentials provided",
          message: "Must provide credentials via one of the supported methods",
          details: {
            supportedMethods: {
              directCredentials:
                "Include awsAccessKeyId and awsSecretAccessKey in request body",
              storedCredentials:
                "Include credentialId referencing stored credentials",
              serviceDefaults:
                "Set useServiceDefaults: true (requires environment variables)",
            },
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Initialize Bedrock integration
      await this.ragService.initializeBedrockIntegration(
        merchantId,
        credentials,
        {
          modelId,
          mode,
          maxTokens,
          temperature,
        }
      );

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          engineName: `bedrock_engine_${merchantId}`,
          modelName: `bedrock_rag_${merchantId}`,
          credentialSource: awsAccessKeyId
            ? "direct"
            : credentialId
              ? "stored"
              : "service-default",
          config: {
            modelId,
            mode,
            maxTokens,
            temperature,
            region: credentials.region,
          },
        },
        message: `Bedrock integration initialized for merchant: ${merchantId}`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error("Bedrock integration initialization error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to initialize Bedrock integration",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Store AWS credentials securely for a merchant
   */
  async storeCredentials(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const {
        credentialId,
        awsAccessKeyId,
        awsSecretAccessKey,
        awsRegion = "us-east-2",
        description = "AWS credentials for Bedrock integration",
      } = req.body;

      if (
        !merchantId ||
        !credentialId ||
        !awsAccessKeyId ||
        !awsSecretAccessKey
      ) {
        const response: ApiResponse = {
          success: false,
          error: "Missing required parameters",
          details: {
            required: [
              "merchantId",
              "credentialId",
              "awsAccessKeyId",
              "awsSecretAccessKey",
            ],
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const secretName = `mindsdb-rag/merchants/${merchantId}/aws-credentials/${credentialId}`;
      const secretValue = JSON.stringify({
        awsAccessKeyId,
        awsSecretAccessKey,
        awsRegion,
        merchantId,
        credentialId,
        createdAt: new Date().toISOString(),
      });

      // Store in AWS Secrets Manager
      const { CreateSecretCommand, UpdateSecretCommand } = await import(
        "@aws-sdk/client-secrets-manager"
      );

      try {
        // Try to create new secret
        const createCommand = new CreateSecretCommand({
          Name: secretName,
          SecretString: secretValue,
          Description: `${description} for merchant ${merchantId}`,
          Tags: [
            { Key: "MerchantId", Value: merchantId },
            { Key: "Service", Value: "MindsDB-RAG-Assistant" },
            { Key: "CredentialType", Value: "AWS-Bedrock" },
          ],
        });
        await this.secretsManager.send(createCommand);
      } catch (error: any) {
        if (error.name === "ResourceExistsException") {
          // Update existing secret
          const updateCommand = new UpdateSecretCommand({
            SecretId: secretName,
            SecretString: secretValue,
            Description: `${description} for merchant ${merchantId} (updated)`,
          });
          await this.secretsManager.send(updateCommand);
        } else {
          throw error;
        }
      }

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          credentialId,
          secretName,
          region: awsRegion,
          storedAt: new Date().toISOString(),
        },
        message: "Credentials stored securely",
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error("Credential storage error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to store credentials",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get Bedrock integration status
   */
  async getBedrockIntegrationStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { merchantId } = req.params;

      if (!merchantId) {
        const response: ApiResponse = {
          success: false,
          error: "merchantId is required",
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const status =
        await this.ragService.getBedrockIntegrationStatus(merchantId);

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          ...status,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error("Bedrock status check error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to get Bedrock integration status",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Ask question using Bedrock integration
   */
  async askWithBedrock(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const {
        question,
        useBedrockIntegration = true,
        bedrockModelName,
        includeContext = true,
        maxDocuments = 5,
      } = req.body;

      if (!merchantId || !question) {
        const response: ApiResponse = {
          success: false,
          error: "Missing required parameters",
          details: {
            required: ["merchantId", "question"],
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.ragService.askWithBedrock(
        merchantId,
        question,
        {
          useBedrockIntegration,
          bedrockModelName,
          includeContext,
          maxDocuments,
        }
      );

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          question,
          ...result,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error("Bedrock question error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to process question with Bedrock",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Query using Bedrock RAG integration
   */
  async queryWithBedrockRAG(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const {
        query,
        useHybridSearch = true,
        maxResults = 5,
        threshold = 0.7,
        includeExplainability = true,
      } = req.body;

      if (!merchantId || !query) {
        const response: ApiResponse = {
          success: false,
          error: "Missing required parameters",
          details: {
            required: ["merchantId", "query"],
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const ragQuery = {
        query,
        merchantId,
        useHybridSearch,
        maxResults,
        threshold,
        includeExplainability,
      };

      const result =
        await this.ragService.queryWithBedrockIntegration(ragQuery);

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          query,
          ...result,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error("Bedrock RAG query error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to process RAG query with Bedrock",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * List available Bedrock models
   */
  async listBedrockModels(req: Request, res: Response): Promise<void> {
    try {
      const models = await this.mindsdbService.listBedrockModels();

      const response: ApiResponse = {
        success: true,
        data: {
          models,
          count: models.length,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error("List Bedrock models error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to list Bedrock models",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Test Bedrock integration
   */
  async testBedrockIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { testQuery = "Hello, can you help me?" } = req.body;

      if (!merchantId) {
        const response: ApiResponse = {
          success: false,
          error: "merchantId is required",
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Test the integration
      const startTime = Date.now();

      const [status, testResult] = await Promise.all([
        this.ragService.getBedrockIntegrationStatus(merchantId),
        this.ragService.askWithBedrock(merchantId, testQuery, {
          useBedrockIntegration: true,
          includeContext: false,
          maxDocuments: 3,
        }),
      ]);

      const executionTime = Date.now() - startTime;

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          testQuery,
          status,
          testResult,
          executionTime,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error("Bedrock integration test error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Bedrock integration test failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }
}

export const bedrockIntegrationController = new BedrockIntegrationController();
