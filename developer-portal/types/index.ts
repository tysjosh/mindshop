import 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    error?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      merchantId: string;
      roles: string;
      emailVerified?: boolean;
    };
  }

  interface User {
    merchantId: string;
    roles: string;
    emailVerified?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    merchantId?: string;
    roles?: string;
    emailVerified?: boolean;
    accessTokenExpires?: number;
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Merchant {
  id: string;
  merchantId: string;
  email: string;
  companyName: string;
  website?: string;
  industry?: string;
  status: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  keyId: string;
  name: string;
  keyPrefix: string;
  environment: 'development' | 'production';
  status: string;
  permissions?: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface Usage {
  queries: {
    count: number;
    limit: number;
    percentage: number;
  };
  documents: {
    count: number;
    limit: number;
    percentage: number;
  };
  apiCalls: {
    count: number;
    limit: number;
    percentage: number;
  };
  storageGb: {
    count: number;
    limit: number;
    percentage: number;
  };
}

export interface Analytics {
  totalQueries: number;
  activeSessions: number;
  avgResponseTime: number;
  successRate: number;
  topQueries: Array<{
    query: string;
    count: number;
    avgConfidence: number;
  }>;
}

export interface BillingInfo {
  id: string;
  merchantId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  merchantId: string;
  stripeInvoiceId: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  invoicePdf?: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  paidAt?: string;
}

export interface PaymentMethod {
  id: string;
  merchantId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'bank_account';
  last4: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  createdAt: string;
}

export interface PlanDetails {
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    queriesPerMonth: number;
    documentsMax: number;
    apiCallsPerDay: number;
    storageGbMax: number;
  };
}

export interface Webhook {
  id: string;
  webhookId: string;
  merchantId: string;
  url: string;
  events: string[];
  secret?: string;
  status: 'active' | 'disabled' | 'failed';
  failureCount: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: any;
  status: 'pending' | 'success' | 'failed';
  statusCode?: number;
  responseBody?: string;
  attemptCount: number;
  nextRetryAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface ProductSyncConfig {
  id: string;
  merchantId: string;
  syncType: 'scheduled' | 'webhook' | 'manual';
  schedule?: string; // cron expression for scheduled sync
  sourceType: 'api' | 'ftp' | 's3' | 'csv';
  sourceUrl?: string;
  fieldMapping: Record<string, string>;
  lastSyncAt?: string;
  nextSyncAt?: string;
  status: 'active' | 'paused' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface ProductSyncHistory {
  id: string;
  merchantId: string;
  syncType: 'scheduled' | 'webhook' | 'manual';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  productsProcessed: number;
  productsCreated: number;
  productsUpdated: number;
  productsSkipped: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number; // in seconds
}

export interface AuditLog {
  id: string;
  timestamp: string;
  merchantId: string;
  userId?: string;
  sessionId?: string;
  operation: string;
  requestPayloadHash: string;
  responseReference: string;
  outcome: 'success' | 'failure';
  reason?: string;
  actor: string;
  ipAddress?: string;
  userAgent?: string;
}
