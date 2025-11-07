# Merchant Platform Design Document
## B2B API/SDK Platform Architecture

## Overview
This document provides the technical design for transforming the MindsDB RAG Assistant into a production-ready B2B platform where merchants can self-serve integration of the RAG assistant into their existing e-commerce sites.

**Design Philosophy:** Build a developer platform (Stripe/Twilio model), not an e-commerce platform.

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MERCHANT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Developer Portal (Next.js)  │  Merchant E-commerce Site        │
│  - Dashboard                 │  - Embedded Widget               │
│  - API Keys                  │  - Mobile App (SDK)              │
│  - Analytics                 │  - Backend Integration (API)     │
│  - Documentation             │                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  API Gateway (Express.js)                                        │
│  - Authentication (Cognito JWT)                                  │
│  - API Key Validation                                            │
│  - Rate Limiting                                                 │
│  - Request Logging                                               │
│  - Usage Metering                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Merchant Services    │  RAG Services     │  Integration Services│
│  - Account Mgmt       │  - Chat           │  - Webhooks          │
│  - API Keys           │  - Documents      │  - Product Sync      │
│  - Billing            │  - Semantic       │  - Platform Connectors│
│  - Analytics          │  - Bedrock Agent  │                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL    │  Redis Cache  │  MindsDB    │  AWS Services    │
│  - Merchants   │  - Sessions   │  - RAG      │  - Cognito       │
│  - API Keys    │  - Rate Limits│  - Semantic │  - Bedrock       │
│  - Usage       │  - Analytics  │  - Predictors│  - S3            │
│  - Webhooks    │               │             │  - CloudFront    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: MVP Design (3-4 months)

### 1. Merchant Account Management

#### 1.1 Database Schema


```sql
-- Merchants table
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'acme_electronics_2024'
  cognito_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  industry VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending_verification', -- pending_verification, active, suspended, deleted
  plan VARCHAR(50) DEFAULT 'starter', -- starter, professional, enterprise
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Merchant settings
CREATE TABLE merchant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR(100) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}', -- widget config, behavior, integrations
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_merchants_merchant_id ON merchants(merchant_id);
CREATE INDEX idx_merchants_email ON merchants(email);
CREATE INDEX idx_merchants_status ON merchants(status);
CREATE INDEX idx_merchant_settings_merchant_id ON merchant_settings(merchant_id);
```

#### 1.2 API Endpoints

**File:** `src/api/routes/merchants.ts`


```typescript
import { Router } from 'express';
import { MerchantController } from '../controllers/MerchantController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
const merchantController = new MerchantController();

// Public routes (no auth)
router.post('/register', merchantController.register);
router.post('/verify-email', merchantController.verifyEmail);
router.post('/resend-verification', merchantController.resendVerification);
router.post('/login', merchantController.login);
router.post('/refresh-token', merchantController.refreshToken);
router.post('/forgot-password', merchantController.forgotPassword);
router.post('/reset-password', merchantController.resetPassword);

// Protected routes (require JWT)
router.get('/:merchantId/profile', authenticateJWT(), merchantController.getProfile);
router.put('/:merchantId/profile', authenticateJWT(), merchantController.updateProfile);
router.get('/:merchantId/settings', authenticateJWT(), merchantController.getSettings);
router.put('/:merchantId/settings', authenticateJWT(), merchantController.updateSettings);
router.delete('/:merchantId/account', authenticateJWT(), merchantController.deleteAccount);

export default router;
```

#### 1.3 Service Layer

**File:** `src/services/MerchantService.ts`


```typescript
import { CognitoIdentityProviderClient, SignUpCommand, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { db } from '../database';

export class MerchantService {
  private cognitoClient: CognitoIdentityProviderClient;

  constructor() {
    this.cognitoClient = new CognitoIdentityProviderClient({ 
      region: process.env.AWS_REGION 
    });
  }

  async register(data: {
    email: string;
    password: string;
    companyName: string;
    website?: string;
    industry?: string;
  }) {
    // 1. Generate merchant ID
    const merchantId = this.generateMerchantId(data.companyName);

    // 2. Create Cognito user
    await this.cognitoClient.send(new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Username: data.email,
      Password: data.password,
      UserAttributes: [
        { Name: 'email', Value: data.email },
        { Name: 'custom:merchant_id', Value: merchantId },
        { Name: 'custom:company_name', Value: data.companyName },
        { Name: 'custom:roles', Value: 'merchant_admin' }
      ]
    }));

    // 3. Create merchant record
    const merchant = await db.merchants.create({
      merchantId,
      email: data.email,
      companyName: data.companyName,
      website: data.website,
      industry: data.industry,
      status: 'pending_verification'
    });

    // 4. Initialize default settings
    await db.merchantSettings.create({
      merchantId,
      settings: this.getDefaultSettings()
    });

    return { merchantId, email: data.email };
  }

  private generateMerchantId(companyName: string): string {
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    const timestamp = Date.now().toString().slice(-6);
    return `${slug}_${timestamp}`;
  }

  private getDefaultSettings() {
    return {
      widget: {
        theme: {
          primaryColor: '#007bff',
          position: 'bottom-right'
        },
        behavior: {
          autoOpen: false,
          greeting: 'Hi! How can I help you today?',
          maxRecommendations: 3
        }
      },
      rag: {
        maxResults: 5,
        threshold: 0.7
      }
    };
  }
}
```

---

### 2. API Key Management

#### 2.1 Database Schema


```sql
-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'key_abc123'
  merchant_id VARCHAR(100) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL, -- e.g., 'pk_live_' or 'pk_test_'
  key_hash VARCHAR(255) NOT NULL, -- bcrypt hash of full key
  environment VARCHAR(20) NOT NULL, -- 'development' or 'production'
  permissions JSONB DEFAULT '[]', -- ['chat:read', 'documents:write']
  status VARCHAR(50) DEFAULT 'active', -- active, revoked, expired
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- API Key usage tracking
CREATE TABLE api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id VARCHAR(50) REFERENCES api_keys(key_id) ON DELETE CASCADE,
  merchant_id VARCHAR(100) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  timestamp TIMESTAMP DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE
);

-- Indexes
CREATE INDEX idx_api_keys_merchant_id ON api_keys(merchant_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_status ON api_keys(status);
CREATE INDEX idx_api_key_usage_key_id ON api_key_usage(key_id);
CREATE INDEX idx_api_key_usage_date ON api_key_usage(date);
```

#### 2.2 API Key Service

**File:** `src/services/ApiKeyService.ts`


```typescript
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../database';

export class ApiKeyService {
  async generateKey(data: {
    merchantId: string;
    name: string;
    environment: 'development' | 'production';
    permissions?: string[];
    expiresInDays?: number;
  }) {
    // 1. Generate key components
    const keyId = `key_${this.generateRandomString(16)}`;
    const prefix = data.environment === 'production' ? 'pk_live_' : 'pk_test_';
    const secret = this.generateRandomString(32);
    const fullKey = `${prefix}${secret}`;

    // 2. Hash the key
    const keyHash = await bcrypt.hash(fullKey, 10);

    // 3. Calculate expiration
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // 4. Store in database
    await db.apiKeys.create({
      keyId,
      merchantId: data.merchantId,
      name: data.name,
      keyPrefix: prefix,
      keyHash,
      environment: data.environment,
      permissions: data.permissions || [],
      expiresAt
    });

    // 5. Return full key (only time it's shown)
    return {
      keyId,
      key: fullKey,
      prefix,
      environment: data.environment,
      expiresAt
    };
  }

  async validateKey(key: string): Promise<{
    valid: boolean;
    merchantId?: string;
    keyId?: string;
    permissions?: string[];
  }> {
    // 1. Extract prefix
    const prefix = key.substring(0, 8); // 'pk_live_' or 'pk_test_'

    // 2. Find keys with matching prefix
    const apiKeys = await db.apiKeys.findByPrefix(prefix);

    // 3. Check each key hash
    for (const apiKey of apiKeys) {
      const isMatch = await bcrypt.compare(key, apiKey.keyHash);
      
      if (isMatch) {
        // Check if expired
        if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
          return { valid: false };
        }

        // Check if revoked
        if (apiKey.status !== 'active') {
          return { valid: false };
        }

        // Update last used
        await db.apiKeys.updateLastUsed(apiKey.keyId);

        return {
          valid: true,
          merchantId: apiKey.merchantId,
          keyId: apiKey.keyId,
          permissions: apiKey.permissions
        };
      }
    }

    return { valid: false };
  }

  private generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
```

#### 2.3 API Key Validation Middleware

**File:** `src/api/middleware/apiKeyAuth.ts`


```typescript
import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../../services/ApiKeyService';
import { ApiResponse } from '../../types';

export interface ApiKeyRequest extends Request {
  apiKey?: {
    keyId: string;
    merchantId: string;
    permissions: string[];
  };
}

export function apiKeyAuth() {
  const apiKeyService = new ApiKeyService();

  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing or invalid API key',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(401).json(response);
    }

    const apiKey = authHeader.substring(7);

    try {
      const validation = await apiKeyService.validateKey(apiKey);

      if (!validation.valid) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid or expired API key',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        return res.status(401).json(response);
      }

      // Attach API key info to request
      req.apiKey = {
        keyId: validation.keyId!,
        merchantId: validation.merchantId!,
        permissions: validation.permissions!
      };

      next();
    } catch (error: any) {
      console.error('API key validation error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Authentication failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(500).json(response);
    }
  };
}

// Permission check middleware
export function requirePermissions(requiredPermissions: string[]) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasPermission = requiredPermissions.every(perm =>
      req.apiKey!.permissions.includes(perm) || req.apiKey!.permissions.includes('*')
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: `Missing required permissions: ${requiredPermissions.join(', ')}`
      });
    }

    next();
  };
}
```

---

### 3. Usage Tracking & Rate Limiting

#### 3.1 Database Schema


```sql
-- Usage tracking (aggregated daily)
CREATE TABLE merchant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR(100) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- 'queries', 'documents', 'api_calls', 'storage_gb'
  metric_value BIGINT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(merchant_id, date, metric_type)
);

-- Usage limits per plan
CREATE TABLE usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR(100) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL,
  queries_per_month INTEGER NOT NULL,
  documents_max INTEGER NOT NULL,
  api_calls_per_day INTEGER NOT NULL,
  storage_gb_max INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_merchant_usage_merchant_date ON merchant_usage(merchant_id, date);
CREATE INDEX idx_merchant_usage_date ON merchant_usage(date);
CREATE INDEX idx_usage_limits_merchant_id ON usage_limits(merchant_id);
```

#### 3.2 Usage Tracking Service

**File:** `src/services/UsageTrackingService.ts`


```typescript
import { db } from '../database';
import { redis } from '../cache';

export class UsageTrackingService {
  async trackUsage(data: {
    merchantId: string;
    metricType: 'queries' | 'documents' | 'api_calls' | 'storage_gb';
    value: number;
    metadata?: any;
  }) {
    const today = new Date().toISOString().split('T')[0];

    // 1. Increment in Redis (real-time)
    const redisKey = `usage:${data.merchantId}:${today}:${data.metricType}`;
    await redis.incrby(redisKey, data.value);
    await redis.expire(redisKey, 86400 * 7); // 7 days

    // 2. Queue for database aggregation (async)
    await this.queueUsageAggregation(data.merchantId, today, data.metricType);
  }

  async getCurrentUsage(merchantId: string): Promise<{
    queries: { count: number; limit: number; percentage: number };
    documents: { count: number; limit: number; percentage: number };
    apiCalls: { count: number; limit: number; percentage: number };
    storageGb: { count: number; limit: number; percentage: number };
  }> {
    // 1. Get limits
    const limits = await db.usageLimits.findByMerchantId(merchantId);

    // 2. Get current month usage from Redis
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const queries = await this.getUsageForPeriod(
      merchantId,
      'queries',
      startOfMonth,
      new Date()
    );

    const documents = await this.getUsageForPeriod(
      merchantId,
      'documents',
      startOfMonth,
      new Date()
    );

    const apiCalls = await this.getUsageForPeriod(
      merchantId,
      'api_calls',
      new Date(Date.now() - 86400000), // last 24 hours
      new Date()
    );

    const storageGb = await this.getUsageForPeriod(
      merchantId,
      'storage_gb',
      startOfMonth,
      new Date()
    );

    return {
      queries: {
        count: queries,
        limit: limits.queriesPerMonth,
        percentage: (queries / limits.queriesPerMonth) * 100
      },
      documents: {
        count: documents,
        limit: limits.documentsMax,
        percentage: (documents / limits.documentsMax) * 100
      },
      apiCalls: {
        count: apiCalls,
        limit: limits.apiCallsPerDay,
        percentage: (apiCalls / limits.apiCallsPerDay) * 100
      },
      storageGb: {
        count: storageGb,
        limit: limits.storageGbMax,
        percentage: (storageGb / limits.storageGbMax) * 100
      }
    };
  }

  async checkLimit(
    merchantId: string,
    metricType: string
  ): Promise<{ allowed: boolean; remaining: number }> {
    const usage = await this.getCurrentUsage(merchantId);
    const metric = usage[metricType as keyof typeof usage];

    return {
      allowed: metric.count < metric.limit,
      remaining: metric.limit - metric.count
    };
  }

  private async getUsageForPeriod(
    merchantId: string,
    metricType: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // Try Redis first (recent data)
    const today = new Date().toISOString().split('T')[0];
    const redisKey = `usage:${merchantId}:${today}:${metricType}`;
    const todayUsage = await redis.get(redisKey);

    // Get historical from database
    const dbUsage = await db.merchantUsage.sumByPeriod(
      merchantId,
      metricType,
      startDate,
      endDate
    );

    return (parseInt(todayUsage || '0') + dbUsage);
  }

  private async queueUsageAggregation(
    merchantId: string,
    date: string,
    metricType: string
  ) {
    // Queue for background job to aggregate into database
    await redis.sadd(`usage:queue:${date}`, `${merchantId}:${metricType}`);
  }
}
```

#### 3.3 Rate Limiting Middleware

**File:** `src/api/middleware/rateLimiting.ts`


```typescript
import { Request, Response, NextFunction } from 'express';
import { UsageTrackingService } from '../../services/UsageTrackingService';
import { ApiKeyRequest } from './apiKeyAuth';

export function rateLimitMiddleware() {
  const usageService = new UsageTrackingService();

  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return next(); // Skip if no API key (handled by auth middleware)
    }

    const merchantId = req.apiKey.merchantId;

    try {
      // Check API call limit
      const limit = await usageService.checkLimit(merchantId, 'api_calls');

      if (!limit.allowed) {
        res.setHeader('X-RateLimit-Limit', limit.remaining + limit.remaining);
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', this.getResetTime());

        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'You have exceeded your daily API call limit',
          retryAfter: this.getResetTime()
        });
      }

      // Track this API call
      await usageService.trackUsage({
        merchantId,
        metricType: 'api_calls',
        value: 1
      });

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit.remaining + 1);
      res.setHeader('X-RateLimit-Remaining', limit.remaining.toString());
      res.setHeader('X-RateLimit-Reset', this.getResetTime());

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next(); // Don't block on rate limit errors
    }
  };

  private getResetTime(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }
}
```

---

### 4. Developer Portal (Frontend)

#### 4.1 Tech Stack

```
Framework: Next.js 14 (App Router)
Language: TypeScript
Styling: Tailwind CSS
Components: shadcn/ui
State Management: React Query (TanStack Query)
Forms: React Hook Form + Zod
Charts: Recharts
Authentication: NextAuth.js (Cognito provider)
```

#### 4.2 Project Structure


```
developer-portal/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Overview
│   │   ├── api-keys/
│   │   │   └── page.tsx          # API key management
│   │   ├── analytics/
│   │   │   └── page.tsx          # Usage analytics
│   │   ├── documentation/
│   │   │   └── page.tsx          # API docs
│   │   ├── settings/
│   │   │   └── page.tsx          # Account settings
│   │   └── layout.tsx            # Dashboard layout with sidebar
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts      # NextAuth config
│   └── layout.tsx
├── components/
│   ├── ui/                        # shadcn/ui components
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── StatsCard.tsx
│   ├── api-keys/
│   │   ├── ApiKeyList.tsx
│   │   ├── CreateApiKeyDialog.tsx
│   │   └── ApiKeyCard.tsx
│   └── analytics/
│       ├── UsageChart.tsx
│       ├── QueryTable.tsx
│       └── MetricsGrid.tsx
├── lib/
│   ├── api-client.ts             # API client with React Query
│   ├── auth.ts                   # Auth utilities
│   └── utils.ts
└── types/
    └── index.ts
```

#### 4.3 Key Pages

**Dashboard Home (`app/(dashboard)/dashboard/page.tsx`)**


```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { UsageChart } from '@/components/analytics/UsageChart';
import { apiClient } from '@/lib/api-client';

export default function DashboardPage() {
  const { data: usage } = useQuery({
    queryKey: ['usage', 'current'],
    queryFn: () => apiClient.getUsage()
  });

  const { data: analytics } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => apiClient.getAnalytics()
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Queries Today"
          value={analytics?.queriesToday || 0}
          change="+12%"
          trend="up"
        />
        <StatsCard
          title="Active Sessions"
          value={analytics?.activeSessions || 0}
          change="+5%"
          trend="up"
        />
        <StatsCard
          title="Avg Response Time"
          value={`${analytics?.avgResponseTime || 0}ms`}
          change="-8%"
          trend="down"
        />
        <StatsCard
          title="Success Rate"
          value={`${analytics?.successRate || 0}%`}
          change="+2%"
          trend="up"
        />
      </div>

      {/* Usage Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Usage This Month</h2>
        <UsageChart data={usage} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickActionCard
          title="Create API Key"
          description="Generate a new API key for your integration"
          href="/api-keys"
        />
        <QuickActionCard
          title="View Documentation"
          description="Learn how to integrate the RAG assistant"
          href="/documentation"
        />
      </div>
    </div>
  );
}
```

**API Keys Page (`app/(dashboard)/api-keys/page.tsx`)**


```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ApiKeyList } from '@/components/api-keys/ApiKeyList';
import { CreateApiKeyDialog } from '@/components/api-keys/CreateApiKeyDialog';
import { apiClient } from '@/lib/api-client';

export default function ApiKeysPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiClient.getApiKeys()
  });

  const deleteMutation = useMutation({
    mutationFn: (keyId: string) => apiClient.deleteApiKey(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">API Keys</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          Create API Key
        </Button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Important:</strong> API keys are shown only once. Store them securely.
        </p>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <ApiKeyList
          apiKeys={apiKeys || []}
          onDelete={(keyId) => deleteMutation.mutate(keyId)}
        />
      )}

      <CreateApiKeyDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
```

---

### 5. Analytics Dashboard

#### 5.1 Analytics Service

**File:** `src/services/AnalyticsService.ts`


```typescript
import { db } from '../database';
import { redis } from '../cache';

export class AnalyticsService {
  async getOverview(merchantId: string, startDate: Date, endDate: Date) {
    const cacheKey = `analytics:overview:${merchantId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const [
      totalQueries,
      activeSessions,
      avgResponseTime,
      successRate,
      topQueries
    ] = await Promise.all([
      this.getTotalQueries(merchantId, startDate, endDate),
      this.getActiveSessions(merchantId),
      this.getAvgResponseTime(merchantId, startDate, endDate),
      this.getSuccessRate(merchantId, startDate, endDate),
      this.getTopQueries(merchantId, startDate, endDate, 10)
    ]);

    const overview = {
      totalQueries,
      activeSessions,
      avgResponseTime,
      successRate,
      topQueries
    };

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(overview));

    return overview;
  }

  async getQueryTimeSeries(
    merchantId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' = 'day'
  ) {
    const query = `
      SELECT 
        DATE_TRUNC('${groupBy}', created_at) as timestamp,
        COUNT(*) as count,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate
      FROM chat_sessions
      WHERE merchant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY DATE_TRUNC('${groupBy}', created_at)
      ORDER BY timestamp ASC
    `;

    return db.query(query, [merchantId, startDate, endDate]);
  }

  async getTopQueries(
    merchantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 20
  ) {
    const query = `
      SELECT 
        query,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence
      FROM chat_messages
      WHERE merchant_id = $1
        AND created_at >= $2
        AND created_at <= $3
        AND role = 'user'
      GROUP BY query
      ORDER BY count DESC
      LIMIT $4
    `;

    return db.query(query, [merchantId, startDate, endDate, limit]);
  }

  private async getTotalQueries(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM chat_messages 
       WHERE merchant_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [merchantId, startDate, endDate]
    );
    return parseInt(result[0].count);
  }

  private async getActiveSessions(merchantId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM chat_sessions 
       WHERE merchant_id = $1 AND status = 'active'`,
      [merchantId]
    );
    return parseInt(result[0].count);
  }

  private async getAvgResponseTime(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await db.query(
      `SELECT AVG(response_time_ms) as avg FROM chat_sessions 
       WHERE merchant_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [merchantId, startDate, endDate]
    );
    return Math.round(parseFloat(result[0].avg) || 0);
  }

  private async getSuccessRate(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await db.query(
      `SELECT 
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as rate
       FROM chat_sessions 
       WHERE merchant_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [merchantId, startDate, endDate]
    );
    return Math.round(parseFloat(result[0].rate) || 0);
  }
}
```

---

## Phase 2: Beta Features (2-3 months)

### 6. Webhook System

#### 6.1 Database Schema


```sql
-- Webhooks table
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id VARCHAR(50) UNIQUE NOT NULL,
  merchant_id VARCHAR(100) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  events TEXT[] NOT NULL, -- ['chat.completed', 'document.created']
  secret VARCHAR(255) NOT NULL, -- For HMAC signature
  status VARCHAR(50) DEFAULT 'active', -- active, disabled, failed
  failure_count INTEGER DEFAULT 0,
  last_success_at TIMESTAMP,
  last_failure_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook deliveries (for audit/retry)
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id VARCHAR(50) REFERENCES webhooks(webhook_id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL, -- pending, success, failed
  status_code INTEGER,
  response_body TEXT,
  attempt_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhooks_merchant_id ON webhooks(merchant_id);
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at);
```

#### 6.2 Webhook Service

**File:** `src/services/WebhookService.ts`


```typescript
import crypto from 'crypto';
import axios from 'axios';
import { db } from '../database';

export class WebhookService {
  async createWebhook(data: {
    merchantId: string;
    url: string;
    events: string[];
  }) {
    const webhookId = `whk_${this.generateRandomString(16)}`;
    const secret = `whsec_${this.generateRandomString(32)}`;

    // Validate URL
    await this.validateWebhookUrl(data.url);

    const webhook = await db.webhooks.create({
      webhookId,
      merchantId: data.merchantId,
      url: data.url,
      events: data.events,
      secret
    });

    return {
      webhookId,
      url: data.url,
      events: data.events,
      secret // Show once
    };
  }

  async triggerEvent(data: {
    merchantId: string;
    eventType: string;
    payload: any;
  }) {
    // Find webhooks subscribed to this event
    const webhooks = await db.webhooks.findByMerchantAndEvent(
      data.merchantId,
      data.eventType
    );

    // Queue delivery for each webhook
    for (const webhook of webhooks) {
      await this.queueDelivery({
        webhookId: webhook.webhookId,
        eventType: data.eventType,
        payload: data.payload
      });
    }
  }

  async deliverWebhook(deliveryId: string) {
    const delivery = await db.webhookDeliveries.findById(deliveryId);
    const webhook = await db.webhooks.findById(delivery.webhookId);

    try {
      // Generate signature
      const signature = this.generateSignature(
        delivery.payload,
        webhook.secret
      );

      // Send webhook
      const response = await axios.post(webhook.url, delivery.payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.eventType,
          'X-Webhook-ID': delivery.id,
          'User-Agent': 'RAG-Assistant-Webhooks/1.0'
        },
        timeout: 10000 // 10 seconds
      });

      // Mark as success
      await db.webhookDeliveries.update(deliveryId, {
        status: 'success',
        statusCode: response.status,
        responseBody: JSON.stringify(response.data).substring(0, 1000),
        deliveredAt: new Date()
      });

      await db.webhooks.update(webhook.webhookId, {
        lastSuccessAt: new Date(),
        failureCount: 0
      });

    } catch (error: any) {
      // Mark as failed
      const attemptCount = delivery.attemptCount + 1;
      const nextRetry = this.calculateNextRetry(attemptCount);

      await db.webhookDeliveries.update(deliveryId, {
        status: 'failed',
        statusCode: error.response?.status,
        responseBody: error.message.substring(0, 1000),
        attemptCount,
        nextRetryAt: attemptCount < 3 ? nextRetry : null
      });

      await db.webhooks.update(webhook.webhookId, {
        lastFailureAt: new Date(),
        failureCount: webhook.failureCount + 1
      });

      // Disable webhook after 10 consecutive failures
      if (webhook.failureCount >= 10) {
        await db.webhooks.update(webhook.webhookId, {
          status: 'disabled'
        });
      }

      // Retry if attempts < 3
      if (attemptCount < 3) {
        setTimeout(() => this.deliverWebhook(deliveryId), nextRetry.getTime() - Date.now());
      }
    }
  }

  private async queueDelivery(data: {
    webhookId: string;
    eventType: string;
    payload: any;
  }) {
    await db.webhookDeliveries.create({
      webhookId: data.webhookId,
      eventType: data.eventType,
      payload: data.payload,
      status: 'pending',
      attemptCount: 0
    });
  }

  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  private calculateNextRetry(attemptCount: number): Date {
    // Exponential backoff: 1min, 5min, 15min
    const delays = [60000, 300000, 900000];
    const delay = delays[attemptCount - 1] || 900000;
    return new Date(Date.now() + delay);
  }

  private async validateWebhookUrl(url: string) {
    // Basic validation
    if (!url.startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS');
    }

    // Test connectivity
    try {
      await axios.get(url, { timeout: 5000 });
    } catch (error) {
      throw new Error('Unable to reach webhook URL');
    }
  }

  private generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
```

---

### 7. JavaScript Widget

#### 7.1 Widget Architecture


```
widget/
├── src/
│   ├── index.ts              # Entry point
│   ├── RAGAssistant.ts       # Main class
│   ├── components/
│   │   ├── ChatWidget.ts     # Widget UI
│   │   ├── MessageList.ts    # Message display
│   │   ├── ProductCard.ts    # Product recommendations
│   │   └── InputBox.ts       # User input
│   ├── services/
│   │   ├── ApiClient.ts      # API communication
│   │   └── Storage.ts        # LocalStorage management
│   ├── styles/
│   │   └── widget.css        # Widget styles
│   └── types/
│       └── index.ts
├── dist/
│   └── widget.js             # Compiled bundle
├── webpack.config.js
└── package.json
```

#### 7.2 Widget Implementation

**File:** `widget/src/RAGAssistant.ts`


```typescript
import { ApiClient } from './services/ApiClient';
import { ChatWidget } from './components/ChatWidget';
import { Storage } from './services/Storage';

export interface RAGConfig {
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
    addToCartCallback?: (product: any) => void;
    checkoutCallback?: (items: any[]) => void;
    analyticsCallback?: (event: any) => void;
  };
}

export class RAGAssistant {
  private config: RAGConfig;
  private apiClient: ApiClient;
  private widget: ChatWidget;
  private storage: Storage;
  private sessionId: string | null = null;

  constructor(config: RAGConfig) {
    this.config = this.mergeWithDefaults(config);
    this.apiClient = new ApiClient(config.apiKey, config.merchantId);
    this.storage = new Storage(config.merchantId);
    this.widget = new ChatWidget(this.config, this);
    
    this.init();
  }

  private async init() {
    // Load or create session
    this.sessionId = this.storage.getSessionId();
    if (!this.sessionId) {
      this.sessionId = await this.createSession();
      this.storage.setSessionId(this.sessionId);
    }

    // Load conversation history
    const history = this.storage.getHistory();
    this.widget.loadHistory(history);

    // Render widget
    this.widget.render();

    // Auto-open if configured
    if (this.config.behavior?.autoOpen) {
      this.widget.open();
    }
  }

  async sendMessage(query: string) {
    // Add user message to UI
    this.widget.addMessage({
      role: 'user',
      content: query,
      timestamp: new Date()
    });

    // Show typing indicator
    this.widget.showTyping();

    try {
      // Call API
      const response = await this.apiClient.chat({
        query,
        sessionId: this.sessionId!,
        merchantId: this.config.merchantId
      });

      // Hide typing indicator
      this.widget.hideTyping();

      // Add assistant response
      this.widget.addMessage({
        role: 'assistant',
        content: response.answer,
        recommendations: response.recommendations,
        timestamp: new Date()
      });

      // Save to storage
      this.storage.addMessage({
        role: 'user',
        content: query,
        timestamp: new Date()
      });
      this.storage.addMessage({
        role: 'assistant',
        content: response.answer,
        recommendations: response.recommendations,
        timestamp: new Date()
      });

      // Track analytics
      if (this.config.integration?.analyticsCallback) {
        this.config.integration.analyticsCallback({
          event: 'message_sent',
          query,
          responseTime: response.executionTime
        });
      }

    } catch (error: any) {
      this.widget.hideTyping();
      this.widget.showError('Sorry, something went wrong. Please try again.');
      console.error('RAG Assistant error:', error);
    }
  }

  async addToCart(product: any) {
    if (this.config.integration?.addToCartCallback) {
      this.config.integration.addToCartCallback(product);
    } else {
      console.warn('No addToCartCallback configured');
    }
  }

  private async createSession(): Promise<string> {
    const response = await this.apiClient.createSession({
      merchantId: this.config.merchantId,
      userId: this.storage.getUserId()
    });
    return response.sessionId;
  }

  private mergeWithDefaults(config: RAGConfig): RAGConfig {
    return {
      ...config,
      theme: {
        primaryColor: '#007bff',
        fontFamily: 'Arial, sans-serif',
        borderRadius: '8px',
        position: 'bottom-right',
        ...config.theme
      },
      behavior: {
        autoOpen: false,
        greeting: 'Hi! How can I help you today?',
        placeholder: 'Ask me anything...',
        maxRecommendations: 3,
        ...config.behavior
      }
    };
  }
}

// Global initialization
(window as any).RAGAssistant = RAGAssistant;
```

---

### 8. Billing Integration (Stripe)

#### 8.1 Database Schema


```sql
-- Billing information
CREATE TABLE billing_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR(100) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_subscription_id VARCHAR(255),
  plan VARCHAR(50) NOT NULL, -- starter, professional, enterprise
  status VARCHAR(50) NOT NULL, -- active, past_due, canceled, trialing
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR(100) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
  amount_due INTEGER NOT NULL, -- in cents
  amount_paid INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(50) NOT NULL, -- draft, open, paid, void, uncollectible
  invoice_pdf VARCHAR(500),
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);

-- Payment methods
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR(100) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL, -- card, bank_account
  last4 VARCHAR(4),
  brand VARCHAR(50),
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_billing_info_merchant_id ON billing_info(merchant_id);
CREATE INDEX idx_invoices_merchant_id ON invoices(merchant_id);
CREATE INDEX idx_payment_methods_merchant_id ON payment_methods(merchant_id);
```

#### 8.2 Billing Service

**File:** `src/services/BillingService.ts`


```typescript
import Stripe from 'stripe';
import { db } from '../database';

export class BillingService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });
  }

  async createCustomer(data: {
    merchantId: string;
    email: string;
    companyName: string;
  }) {
    // Create Stripe customer
    const customer = await this.stripe.customers.create({
      email: data.email,
      name: data.companyName,
      metadata: {
        merchantId: data.merchantId
      }
    });

    // Store in database
    await db.billingInfo.create({
      merchantId: data.merchantId,
      stripeCustomerId: customer.id,
      plan: 'starter',
      status: 'trialing'
    });

    return customer;
  }

  async subscribe(data: {
    merchantId: string;
    plan: 'starter' | 'professional' | 'enterprise';
    paymentMethodId: string;
  }) {
    const billingInfo = await db.billingInfo.findByMerchantId(data.merchantId);
    
    // Get price ID for plan
    const priceId = this.getPriceId(data.plan);

    // Attach payment method
    await this.stripe.paymentMethods.attach(data.paymentMethodId, {
      customer: billingInfo.stripeCustomerId
    });

    // Set as default
    await this.stripe.customers.update(billingInfo.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: data.paymentMethodId
      }
    });

    // Create subscription
    const subscription = await this.stripe.subscriptions.create({
      customer: billingInfo.stripeCustomerId,
      items: [{ price: priceId }],
      metadata: {
        merchantId: data.merchantId
      }
    });

    // Update database
    await db.billingInfo.update(data.merchantId, {
      stripeSubscriptionId: subscription.id,
      plan: data.plan,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });

    // Update usage limits
    await this.updateUsageLimits(data.merchantId, data.plan);

    return subscription;
  }

  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    const merchantId = invoice.metadata?.merchantId;
    if (!merchantId) return;

    // Store invoice
    await db.invoices.create({
      merchantId,
      stripeInvoiceId: invoice.id,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status!,
      invoicePdf: invoice.invoice_pdf,
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
      paidAt: new Date()
    });

    // Update billing status
    await db.billingInfo.updateByMerchantId(merchantId, {
      status: 'active'
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const merchantId = invoice.metadata?.merchantId;
    if (!merchantId) return;

    // Update billing status
    await db.billingInfo.updateByMerchantId(merchantId, {
      status: 'past_due'
    });

    // TODO: Send notification to merchant
  }

  private getPriceId(plan: string): string {
    const priceIds = {
      starter: process.env.STRIPE_PRICE_STARTER!,
      professional: process.env.STRIPE_PRICE_PROFESSIONAL!,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE!
    };
    return priceIds[plan as keyof typeof priceIds];
  }

  private async updateUsageLimits(merchantId: string, plan: string) {
    const limits = {
      starter: {
        queriesPerMonth: 1000,
        documentsMax: 100,
        apiCallsPerDay: 5000,
        storageGbMax: 1
      },
      professional: {
        queriesPerMonth: 10000,
        documentsMax: 1000,
        apiCallsPerDay: 50000,
        storageGbMax: 10
      },
      enterprise: {
        queriesPerMonth: 999999999,
        documentsMax: 999999999,
        apiCallsPerDay: 999999999,
        storageGbMax: 1000
      }
    };

    await db.usageLimits.upsert({
      merchantId,
      plan,
      ...limits[plan as keyof typeof limits]
    });
  }
}
```

---

## Deployment Architecture

### Production Infrastructure


```
┌─────────────────────────────────────────────────────────────────┐
│                         CLOUDFRONT CDN                           │
│  - Widget.js distribution                                        │
│  - Static assets                                                 │
│  - SSL/TLS termination                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LOAD BALANCER                   │
│  - SSL termination                                               │
│  - Health checks                                                 │
│  - Auto-scaling triggers                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   API Gateway (ECS)      │   │  Developer Portal (ECS)  │
│   - Express.js           │   │  - Next.js               │
│   - Auto-scaling         │   │  - Auto-scaling          │
│   - 2+ instances         │   │  - 2+ instances          │
└──────────────────────────┘   └──────────────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                               │
├──────────────────┬──────────────────┬──────────────────────────┤
│  RDS PostgreSQL  │  ElastiCache     │  AWS Services            │
│  - Multi-AZ      │  - Redis Cluster │  - Cognito               │
│  - Read replicas │  - 3+ nodes      │  - Bedrock               │
│  - Automated     │  - Persistence   │  - S3                    │
│    backups       │                  │  - SES (email)           │
└──────────────────┴──────────────────┴──────────────────────────┘
```

### Environment Configuration

**Development:**
```yaml
API Gateway: Local (Docker)
Developer Portal: Local (npm run dev)
Database: Local PostgreSQL (Docker)
Redis: Local Redis (Docker)
Cognito: Dev User Pool
Stripe: Test mode
```

**Staging:**
```yaml
API Gateway: ECS (1 instance)
Developer Portal: ECS (1 instance)
Database: RDS (single-AZ)
Redis: ElastiCache (single node)
Cognito: Staging User Pool
Stripe: Test mode
```

**Production:**
```yaml
API Gateway: ECS (2+ instances, auto-scaling)
Developer Portal: ECS (2+ instances, auto-scaling)
Database: RDS (Multi-AZ, read replicas)
Redis: ElastiCache (cluster mode, 3+ nodes)
Cognito: Production User Pool
Stripe: Live mode
```

---

## Security Considerations

### 1. API Key Security
- Store hashed keys (bcrypt)
- Rate limit key validation attempts
- Rotate keys regularly
- Audit key usage

### 2. Authentication
- Cognito JWT validation
- Token expiration (1 hour)
- Refresh token rotation
- MFA for admin accounts

### 3. Data Protection
- Encrypt at rest (RDS encryption)
- Encrypt in transit (TLS 1.3)
- PII redaction before LLM calls
- GDPR compliance (data deletion)

### 4. Rate Limiting
- Per-merchant limits
- Per-API-key limits
- Per-IP limits (DDoS protection)
- Exponential backoff

### 5. Webhook Security
- HTTPS only
- HMAC signature validation
- Retry with exponential backoff
- Auto-disable after failures

---

## Monitoring & Observability

### Metrics to Track

**Application Metrics:**
- Request rate (requests/sec)
- Response time (p50, p95, p99)
- Error rate (%)
- Cache hit rate (%)

**Business Metrics:**
- Active merchants
- Queries per merchant
- Revenue (MRR, ARR)
- Churn rate

**Infrastructure Metrics:**
- CPU utilization
- Memory utilization
- Database connections
- Redis memory usage

### Logging Strategy

**Structured Logging:**
```typescript
{
  timestamp: '2025-11-01T12:00:00Z',
  level: 'info',
  service: 'api-gateway',
  merchantId: 'acme_electronics_2024',
  requestId: 'req_abc123',
  endpoint: '/api/chat',
  method: 'POST',
  statusCode: 200,
  responseTime: 245,
  userId: 'user_123'
}
```

**Log Aggregation:**
- CloudWatch Logs
- Log retention: 30 days
- Alerts on error spikes
- Dashboard for real-time monitoring

---

## Testing Strategy

### Unit Tests
- Service layer (80%+ coverage)
- Utility functions
- Validation logic

### Integration Tests
- API endpoints
- Database operations
- External service mocks (Cognito, Stripe)

### End-to-End Tests
- User registration flow
- API key generation
- Chat query flow
- Billing flow

### Load Tests
- 1000 concurrent users
- 10,000 requests/minute
- Response time < 500ms (p95)

---

## Migration Plan

### Phase 1: MVP (Months 1-4)
**Week 1-2:** Database schema + migrations
**Week 3-4:** Merchant account API
**Week 5-6:** API key management
**Week 7-8:** Usage tracking
**Week 9-10:** Developer portal (basic)
**Week 11-12:** Analytics dashboard
**Week 13-14:** JavaScript widget
**Week 15-16:** Documentation + testing

### Phase 2: Beta (Months 5-7)
**Week 17-18:** Billing integration (Stripe)
**Week 19-20:** Webhook system
**Week 21-22:** Admin panel
**Week 23-24:** Product sync automation
**Week 25-26:** Enhanced documentation
**Week 27-28:** Beta testing + bug fixes

### Phase 3: Production (Months 8-10)
**Week 29-32:** E-commerce integrations (Shopify, WooCommerce)
**Week 33-36:** Mobile SDKs (iOS, Android)
**Week 37-38:** Advanced features (A/B testing, white-label)
**Week 39-40:** Load testing + optimization
**Week 41-42:** Security audit + penetration testing
**Week 43-44:** Production deployment + monitoring

---

## Success Metrics

### Technical Metrics
- 99.9% uptime
- < 500ms p95 response time
- < 1% error rate
- 80%+ cache hit rate

### Business Metrics
- 100 merchants onboarded (6 months)
- 80% activation rate
- < 5% monthly churn
- $50k MRR (6 months)

### Developer Experience
- < 24 hours to first query
- 90+ NPS score
- < 2 support tickets per merchant/month
- 4.5+ star rating

---

## Conclusion

This design provides a comprehensive blueprint for building a production-ready B2B API/SDK platform. The phased approach allows for iterative development with clear milestones and success criteria.

**Key Takeaways:**
1. Focus on developer experience (like Stripe)
2. Build self-service from day one
3. Prioritize security and reliability
4. Monitor everything
5. Iterate based on merchant feedback

**Next Steps:**
1. Review and approve design
2. Set up development environment
3. Create detailed task breakdown
4. Begin Phase 1 implementation
