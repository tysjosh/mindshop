// Core data models and interfaces for MindsDB RAG Assistant

export interface Document {
  id: string;
  merchantId: string;
  sku?: string;
  title: string;
  body: string;
  metadata: Record<string, any>;
  embedding: number[];
  documentType: 'product' | 'faq' | 'policy' | 'review';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  merchantId: string;
  conversationHistory: Message[];
  context: UserContext;
  createdAt: Date;
  lastActivity: Date;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UserContext {
  preferences: Record<string, any>;
  purchaseHistory: string[];
  currentCart: CartItem[];
  demographics: Record<string, any>;
}

export interface CartItem {
  sku: string;
  quantity: number;
  price: number;
  name?: string;
  metadata?: Record<string, any>;
}

export interface RetrievalResult {
  id: string;
  snippet: string;
  score: number;
  relevance?: number;
  metadata: {
    sku?: string;
    merchantId: string;
    documentType: string;
    sourceUri?: string;
    title?: string;
    createdAt?: string;
    chunkId?: string;
    originalDocId?: string;
  };
  groundingPass: boolean;
}

export interface EnhancedRetrievalResult extends RetrievalResult {
  confidence: number;
  sourceUri?: string;
  documentType: string;
  groundingValidation: {
    passed: boolean;
    score: number;
    reasons: string[];
  };
  explainability: {
    queryTermMatches: string[];
    semanticSimilarity: number;
    contextualRelevance: number;
  };
}

export interface SemanticRetrievalParams {
  query: string;
  merchantId: string;
  limit?: number;
  threshold?: number;
  includeMetadata?: boolean;
  documentTypes?: string[];
}

export interface SemanticRetrievalResponse {
  results: EnhancedRetrievalResult[];
  totalFound: number;
  queryProcessingTime: number;
  cacheHit: boolean;
  explainability: {
    queryAnalysis: {
      originalQuery: string;
      processedQuery: string;
      extractedTerms: string[];
      queryIntent: string;
    };
    retrievalStrategy: {
      algorithm: string;
      parameters: Record<string, any>;
      optimizations: string[];
    };
  };
}

export interface PredictionResult {
  sku: string;
  demandScore: number;
  purchaseProbability: number;
  explanation: string;
  featureImportance: Record<string, number>; // explicit per-feature weight
  provenance: {
    modelId: string;
    modelVersion: string;
    trainingDate: string;
  };
  confidence: number;
  merchantId: string;
  timestamp: string;
}

export interface EnhancedPredictionResult extends PredictionResult {
  featureGroups: {
    demographic: Record<string, number>;
    behavioral: Record<string, number>;
    product: Record<string, number>;
    contextual: Record<string, number>;
  };
  explainability: {
    shapValues?: Record<string, number>;
    limeExplanation?: string;
    topFeatures: Array<{
      feature: string;
      importance: number;
      value: any;
      group: string;
    }>;
  };
  modelProvenance: {
    predictorName: string;
    createdBy: string;
    version: string;
    featureCount: number;
  };
}

export interface RAGResponse {
  answer: string;
  sources: DocumentReference[];
  predictions: PredictionResult[];
  confidence: number;
  reasoning: string[];
}

export interface DocumentReference {
  id: string;
  title: string;
  snippet: string;
  sourceUri?: string;
  relevanceScore: number;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  merchantId: string;
  userId?: string;
  sessionId?: string;
  operation: string; // e.g., 'predict', 'retrieve', 'checkout'
  requestPayloadHash: string;
  responseReference: string; // S3 path for full response object
  outcome: 'success' | 'failure';
  reason?: string;
  actor: string; // service or user
  ipAddress?: string;
  userAgent?: string;
}

export interface IntentPlan {
  intent: string;
  confidence: number;
  requiredTools: string[];
  parameters: Record<string, any>;
  steps: PlanStep[];
}

export interface PlanStep {
  stepId: string;
  tool: string;
  parameters: Record<string, any>;
  dependencies: string[];
}

export interface ToolResults {
  stepId: string;
  tool: string;
  result: any;
  success: boolean;
  error?: string;
  executionTime: number;
}

export interface SessionContext {
  sessionId: string;
  merchantId: string;
  userId?: string;
  conversationHistory: Message[];
  userContext: UserContext;
}

export interface RedactedQuery {
  sanitizedText: string;
  tokens: Map<string, string>;
}

export interface TokenizedContext {
  tokenizedData: Record<string, string>;
  tokenMap: Map<string, string>;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
}

export interface PromptTemplate {
  system: string;
  userQuery: string;
  context: {
    documents: RetrievalResult[];
    predictions: PredictionResult[];
    sessionState: UserSession;
  };
  instructions: string[];
  constraints: string[];
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  requestId: string;
}

export interface ChatRequest {
  query: string;
  sessionId?: string;
  merchantId: string;
  userId?: string;
  context?: Partial<UserContext>;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  sources: DocumentReference[];
  predictions: PredictionResult[];
  confidence: number;
  reasoning: string[];
}

// Configuration types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  ttl: number;
  tls?: boolean;
  keyPrefix?: string;
}

export interface AWSConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

export interface MindsDBConfig {
  endpoint: string;
  apiKey: string;
  username?: string;
  password?: string;
  timeout: number;
  embeddingModel?: string;
  batchSize?: number;
  maxConcurrency?: number;
}

export interface BedrockConfig {
  region: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
}

// Model Retraining and Drift Detection types
export interface RetrainingJobConfig {
  merchantId: string;
  predictorName: string;
  trainingDataQuery: string;
  schedule: 'weekly' | 'monthly' | 'on-demand';
  spotInstanceConfig: {
    instanceType: string;
    maxPrice: number;
    availabilityZone?: string;
  };
  resourceLimits: {
    cpu: string;
    memory: string;
    timeout: number; // in seconds
  };
}

export interface RetrainingJobStatus {
  jobId: string;
  merchantId: string;
  predictorName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  progress: number; // 0-100
  logs: string[];
  error?: string;
  costEstimate: number;
  actualCost?: number;
  modelVersion: string;
  artifactLocation: string;
}

export interface ModelArtifact {
  modelId: string;
  version: string;
  merchantId: string;
  predictorName: string;
  s3Location: string;
  metadata: {
    trainingDataSize: number;
    accuracy: number;
    features: string[];
    hyperparameters: Record<string, any>;
    trainingDuration: number;
    datasetHash: string;
    modelSize: number;
  };
  createdAt: Date;
  size: number; // in bytes
  checksum: string;
  tags: Record<string, string>;
}

export interface DriftMetrics {
  merchantId: string;
  predictorName: string;
  timestamp: Date;
  confidenceDistribution: {
    mean: number;
    std: number;
    percentiles: Record<string, number>;
  };
  accuracyMetrics: {
    current: number;
    baseline: number;
    drift: number; // percentage change
  };
  featureImportanceShift: Record<string, number>;
  dataDistributionShift: number;
  alertThreshold: number;
  shouldRetrain: boolean;
}

export interface DriftDetectionConfig {
  merchantId: string;
  predictorName: string;
  monitoringWindow: number; // in hours
  confidenceThreshold: number; // 0-1
  accuracyThreshold: number; // 0-1
  featureImportanceThreshold: number; // 0-1
  dataDistributionThreshold: number; // 0-1
  alertChannels: ('email' | 'slack' | 'sns')[];
  autoRetrain: boolean;
}

export interface DriftAlert {
  id: string;
  merchantId: string;
  predictorName: string;
  alertType: 'confidence_drift' | 'accuracy_drift' | 'feature_drift' | 'data_drift';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metrics: DriftMetrics;
  timestamp: Date;
  acknowledged: boolean;
  actionTaken?: string;
}