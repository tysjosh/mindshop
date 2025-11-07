// Merchant Platform TypeScript Types
// These types extend the Drizzle schema types with additional business logic types

import type {
  Merchant,
  NewMerchant,
  MerchantSettings,
  NewMerchantSettings,
  ApiKey,
  NewApiKey,
  ApiKeyUsage,
  NewApiKeyUsage,
  MerchantUsage,
  NewMerchantUsage,
  UsageLimit,
  NewUsageLimit,
  Webhook,
  NewWebhook,
  WebhookDelivery,
  NewWebhookDelivery,
  BillingInfo,
  NewBillingInfo,
  Invoice,
  NewInvoice,
  PaymentMethod,
  NewPaymentMethod,
} from '../database/schema';

// Re-export Drizzle types for convenience
export type {
  Merchant,
  NewMerchant,
  MerchantSettings,
  NewMerchantSettings,
  ApiKey,
  NewApiKey,
  ApiKeyUsage,
  NewApiKeyUsage,
  MerchantUsage,
  NewMerchantUsage,
  UsageLimit,
  NewUsageLimit,
  Webhook,
  NewWebhook,
  WebhookDelivery,
  NewWebhookDelivery,
  BillingInfo,
  NewBillingInfo,
  Invoice,
  NewInvoice,
  PaymentMethod,
  NewPaymentMethod,
};

// ============================================================================
// Merchant Account Types
// ============================================================================

export interface MerchantRegistrationRequest {
  email: string;
  password: string;
  companyName: string;
  website?: string;
  industry?: string;
}

export interface MerchantRegistrationResponse {
  merchantId: string;
  email: string;
  message: string;
}

export interface MerchantLoginRequest {
  email: string;
  password: string;
}

export interface MerchantLoginResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  merchantId: string;
  email: string;
}

export interface MerchantProfile {
  merchantId: string;
  email: string;
  companyName: string;
  website?: string;
  industry?: string;
  status: 'pending_verification' | 'active' | 'suspended' | 'deleted';
  plan: 'starter' | 'professional' | 'enterprise';
  createdAt: Date;
  verifiedAt?: Date;
}

export interface MerchantProfileUpdateRequest {
  companyName?: string;
  website?: string;
  industry?: string;
}

export interface MerchantSettingsData {
  widget?: {
    theme?: {
      primaryColor?: string;
      fontFamily?: string;
      borderRadius?: string;
      position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    };
    behavior?: {
      autoOpen?: boolean;
      greeting?: string;
      placeholder?: string;
      maxRecommendations?: number;
    };
  };
  rag?: {
    maxResults?: number;
    threshold?: number;
  };
  notifications?: {
    email?: boolean;
    webhook?: boolean;
    usageAlerts?: boolean;
  };
}

// ============================================================================
// API Key Types
// ============================================================================

export interface ApiKeyGenerateRequest {
  name: string;
  environment: 'development' | 'production';
  permissions?: string[];
  expiresInDays?: number;
}

export interface ApiKeyGenerateResponse {
  keyId: string;
  key: string; // Full key shown only once
  prefix: string;
  environment: 'development' | 'production';
  expiresAt?: Date;
  message: string;
}

export interface ApiKeyListItem {
  keyId: string;
  name: string;
  prefix: string;
  environment: 'development' | 'production';
  status: 'active' | 'revoked' | 'expired';
  permissions: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  merchantId?: string;
  keyId?: string;
  permissions?: string[];
  error?: string;
}

export interface ApiKeyRotateResponse {
  keyId: string;
  newKey: string;
  oldKeyExpiresAt: Date;
  message: string;
}

export interface ApiKeyUsageStats {
  keyId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  lastUsedAt?: Date;
  usageByEndpoint: Array<{
    endpoint: string;
    count: number;
    avgResponseTime: number;
  }>;
  usageByDay: Array<{
    date: string;
    count: number;
  }>;
}

// ============================================================================
// Usage Tracking Types
// ============================================================================

export interface UsageMetrics {
  queries: {
    count: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
  documents: {
    count: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
  apiCalls: {
    count: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
  storageGb: {
    count: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
  costEstimate: number;
}

export interface UsageHistoryItem {
  date: string;
  queries: number;
  documents: number;
  apiCalls: number;
  storageGb: number;
  cost: number;
}

export interface UsageHistoryResponse {
  startDate: string;
  endDate: string;
  data: UsageHistoryItem[];
  totalQueries: number;
  totalApiCalls: number;
  totalCost: number;
}

export interface UsageLimitCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt?: Date;
}

export interface UsageForecast {
  currentUsage: number;
  projectedUsage: number;
  projectedDate: string;
  willExceedLimit: boolean;
  daysUntilLimit?: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface AnalyticsOverview {
  totalQueries: number;
  activeSessions: number;
  avgResponseTime: number;
  successRate: number;
  topQueries: Array<{
    query: string;
    count: number;
    avgConfidence: number;
  }>;
  queryTrends: {
    today: number;
    yesterday: number;
    percentageChange: number;
  };
}

export interface QueryAnalytics {
  timestamp: string;
  count: number;
  avgResponseTime: number;
  successRate: number;
}

export interface TopQuery {
  query: string;
  count: number;
  avgConfidence: number;
  avgResponseTime: number;
  successRate: number;
}

export interface IntentDistribution {
  intent: string;
  count: number;
  percentage: number;
}

export interface PerformanceMetrics {
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  cacheHitRate: number;
  errorRate: number;
  uptime: number;
}

export interface AnalyticsRequest {
  startDate: string;
  endDate: string;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  limit?: number;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookCreateRequest {
  url: string;
  events: WebhookEventType[];
  secret?: string;
}

export interface WebhookCreateResponse {
  webhookId: string;
  url: string;
  events: WebhookEventType[];
  secret: string; // Shown only once
  status: 'active' | 'disabled' | 'failed';
}

export type WebhookEventType =
  | 'chat.query.completed'
  | 'chat.query.failed'
  | 'document.created'
  | 'document.updated'
  | 'document.deleted'
  | 'usage.limit.approaching'
  | 'usage.limit.exceeded'
  | 'api_key.expiring'
  | 'billing.payment.succeeded'
  | 'billing.payment.failed';

export interface WebhookListItem {
  webhookId: string;
  url: string;
  events: WebhookEventType[];
  status: 'active' | 'disabled' | 'failed';
  failureCount: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  createdAt: Date;
}

export interface WebhookUpdateRequest {
  url?: string;
  events?: WebhookEventType[];
  status?: 'active' | 'disabled';
}

export interface WebhookDeliveryItem {
  id: string;
  eventType: WebhookEventType;
  status: 'pending' | 'success' | 'failed';
  statusCode?: number;
  attemptCount: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  payload: any;
  responseBody?: string;
}

export interface WebhookTestRequest {
  eventType: WebhookEventType;
  payload?: any;
}

export interface WebhookPayload {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  merchantId: string;
  data: any;
}

// ============================================================================
// Billing Types
// ============================================================================

export interface BillingSubscribeRequest {
  plan: 'starter' | 'professional' | 'enterprise';
  paymentMethodId: string;
}

export interface BillingSubscribeResponse {
  subscriptionId: string;
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  amount: number;
  currency: string;
}

export interface BillingCurrentResponse {
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  amount: number;
  currency: string;
  nextInvoiceDate?: Date;
  nextInvoiceAmount?: number;
}

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  invoicePdf?: string;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  paidAt?: Date;
}

export interface PaymentMethodCreateRequest {
  type: 'card' | 'bank_account';
  stripePaymentMethodId: string;
  isDefault?: boolean;
}

export interface PaymentMethodListItem {
  id: string;
  type: 'card' | 'bank_account';
  last4?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  createdAt: Date;
}

export interface BillingPlanDetails {
  name: 'starter' | 'professional' | 'enterprise';
  displayName: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: {
    queriesPerMonth: number;
    documentsMax: number;
    apiCallsPerDay: number;
    storageGbMax: number;
    support: string;
    customBranding: boolean;
    sla: boolean;
  };
}

// ============================================================================
// Admin Types
// ============================================================================

export interface AdminMerchantListItem {
  merchantId: string;
  email: string;
  companyName: string;
  status: 'pending_verification' | 'active' | 'suspended' | 'deleted';
  plan: 'starter' | 'professional' | 'enterprise';
  createdAt: Date;
  lastActivity?: Date;
  totalQueries: number;
  totalRevenue: number;
}

export interface AdminMerchantDetail extends MerchantProfile {
  apiKeys: ApiKeyListItem[];
  usage: UsageMetrics;
  billing: BillingCurrentResponse;
  recentActivity: Array<{
    timestamp: Date;
    action: string;
    details: string;
  }>;
}

export interface AdminSystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  services: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    lastCheck: Date;
  }>;
  metrics: {
    requestRate: number;
    errorRate: number;
    avgResponseTime: number;
    activeConnections: number;
  };
}

export interface AdminSystemMetrics {
  timestamp: Date;
  cpu: number;
  memory: number;
  disk: number;
  network: {
    inbound: number;
    outbound: number;
  };
  database: {
    connections: number;
    queryTime: number;
  };
  redis: {
    memory: number;
    hitRate: number;
  };
}

export interface AdminErrorLog {
  id: string;
  timestamp: Date;
  level: 'error' | 'warning' | 'critical';
  service: string;
  message: string;
  stack?: string;
  merchantId?: string;
  userId?: string;
  requestId?: string;
  metadata?: any;
}

// ============================================================================
// Product Sync Types
// ============================================================================

export interface ProductSyncConfig {
  merchantId: string;
  syncType: 'scheduled' | 'webhook' | 'manual';
  schedule?: 'hourly' | 'daily' | 'weekly';
  source: {
    type: 'api' | 'ftp' | 's3' | 'webhook';
    endpoint?: string;
    credentials?: any;
  };
  fieldMapping: {
    sku: string;
    title: string;
    description: string;
    price: string;
    imageUrl?: string;
    category?: string;
    [key: string]: string | undefined;
  };
  filters?: {
    categories?: string[];
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  };
}

export interface ProductSyncStatus {
  merchantId: string;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  status: 'idle' | 'syncing' | 'error';
  totalProducts: number;
  syncedProducts: number;
  failedProducts: number;
  error?: string;
}

export interface ProductSyncHistory {
  id: string;
  merchantId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'success' | 'partial' | 'failed';
  totalProducts: number;
  syncedProducts: number;
  failedProducts: number;
  duration: number;
  errors?: Array<{
    sku: string;
    error: string;
  }>;
}

// ============================================================================
// Widget Types
// ============================================================================

export interface WidgetConfig {
  merchantId: string;
  apiKey: string;
  theme?: {
    primaryColor?: string;
    fontFamily?: string;
    borderRadius?: string;
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  };
  behavior?: {
    autoOpen?: boolean;
    greeting?: string;
    placeholder?: string;
    maxRecommendations?: number;
  };
  integration?: {
    addToCartCallback?: string;
    checkoutCallback?: string;
    analyticsCallback?: string;
  };
}

export interface WidgetMessage {
  role: 'user' | 'assistant';
  content: string;
  recommendations?: Array<{
    sku: string;
    title: string;
    price: number;
    imageUrl?: string;
  }>;
  timestamp: Date;
}

export interface WidgetChatRequest {
  query: string;
  sessionId?: string;
  merchantId: string;
  userId?: string;
}

export interface WidgetChatResponse {
  answer: string;
  sessionId: string;
  recommendations: Array<{
    sku: string;
    title: string;
    price: number;
    imageUrl?: string;
    description?: string;
  }>;
  executionTime: number;
}

// ============================================================================
// API Response Wrapper Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  timestamp: string;
  requestId: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
  requestId: string;
}

// ============================================================================
// Request Context Types
// ============================================================================

export interface RequestContext {
  merchantId: string;
  userId?: string;
  apiKeyId?: string;
  permissions: string[];
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
}

export interface AuthenticatedRequest {
  merchantId: string;
  email: string;
  roles: string[];
  cognitoUserId: string;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
