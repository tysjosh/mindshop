import { Merchant, ApiKey, Usage, Analytics, BillingInfo, Invoice, PaymentMethod, Webhook, WebhookDelivery, ProductSyncConfig, ProductSyncHistory } from '@/types';
import { getSession } from 'next-auth/react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get the current session access token
   * This method extracts the JWT token from the NextAuth session
   */
  private async getAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') {
      // Server-side: cannot access session
      return null;
    }

    try {
      const session = await getSession();
      return session?.accessToken || null;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  private getImpersonationHeaders(): Record<string, string> {
    // Check if we're in impersonation mode
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('impersonation_state');
      if (stored) {
        try {
          const state = JSON.parse(stored);
          if (state.isImpersonating && state.token) {
            return {
              'X-Impersonation-Token': state.token,
            };
          }
        } catch (error) {
          console.error('Failed to parse impersonation state:', error);
        }
      }
    }
    return {};
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Get access token from session
    const accessToken = await this.getAccessToken();
    
    // Merge impersonation headers with request headers
    const impersonationHeaders = this.getImpersonationHeaders();
    
    // Build headers with automatic token injection
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...impersonationHeaders,
      ...(options.headers as Record<string, string> || {}),
    };

    // Add Authorization header if token is available and not already set
    if (accessToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      // If we get a 401, it might be due to an expired token
      // The session will be automatically refreshed by NextAuth on the next request
      // or the user will be redirected to login if the refresh token is expired
      if (response.status === 401) {
        // Trigger a session refresh by calling getSession again
        // This will cause NextAuth to refresh the token if possible
        await getSession();
        
        const error = new Error(json.error || json.message || 'Unauthorized') as Error & { status?: number };
        error.status = 401;
        throw error;
      }
      
      throw new Error(json.error || json.message || 'Request failed');
    }

    // Backend returns { success: true, data: {...} }
    // Unwrap the data property if it exists
    if (json.success && json.data !== undefined) {
      return json.data as T;
    }

    return json as T;
  }

  // Merchant endpoints
  async getMerchantProfile(merchantId: string, token?: string): Promise<Merchant> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<Merchant>(`/merchants/${merchantId}/profile`, {
      headers,
    });
  }

  async updateMerchantProfile(
    merchantId: string,
    data: Partial<Merchant>,
    token?: string
  ): Promise<Merchant> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<Merchant>(`/merchants/${merchantId}/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
  }

  async getMerchantSettings(merchantId: string, token?: string): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<Record<string, unknown>>(`/merchants/${merchantId}/settings`, {
      headers,
    });
  }

  async updateMerchantSettings(
    merchantId: string,
    settings: Record<string, unknown>,
    token?: string
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<Record<string, unknown>>(`/merchants/${merchantId}/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ settings }),
    });
  }

  async deleteMerchantAccount(merchantId: string, token?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<void>(`/merchants/${merchantId}/account`, {
      method: 'DELETE',
      headers,
    });
  }

  // API Key endpoints
  async getApiKeys(merchantId: string, token?: string): Promise<ApiKey[]> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await this.request<{ keys: ApiKey[]; total: number }>(`/merchants/${merchantId}/api-keys`, {
      headers,
    });
    return response.keys;
  }

  async createApiKey(
    merchantId: string,
    data: {
      name: string;
      environment: 'development' | 'production';
      permissions?: string[];
    },
    token?: string
  ): Promise<ApiKey & { key: string }> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<ApiKey & { key: string }>(
      `/merchants/${merchantId}/api-keys`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      }
    );
  }

  async deleteApiKey(
    merchantId: string,
    keyId: string,
    token?: string
  ): Promise<void> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<void>(`/merchants/${merchantId}/api-keys/${keyId}`, {
      method: 'DELETE',
      headers,
    });
  }

  async rotateApiKey(
    merchantId: string,
    keyId: string,
    gracePeriodDays: number,
    token?: string
  ): Promise<ApiKey & { key: string }> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<ApiKey & { key: string }>(
      `/merchants/${merchantId}/api-keys/${keyId}/rotate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ gracePeriodDays }),
      }
    );
  }

  async getApiKeyUsage(
    merchantId: string,
    keyId: string,
    startDate?: string,
    endDate?: string,
    token?: string
  ): Promise<{
    keyId: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    usageByEndpoint: Array<{
      endpoint: string;
      count: number;
      avgResponseTime: number;
    }>;
  }> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/merchants/${merchantId}/api-keys/${keyId}/usage${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.request<{
      keyId: string;
      usage: {
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
        avgResponseTime: number;
        usageByEndpoint: Array<{
          endpoint: string;
          count: number;
          avgResponseTime: number;
        }>;
      };
      period: {
        startDate: string;
        endDate: string;
      };
    }>(url, {
      headers: token ? {
        Authorization: `Bearer ${token}`,
      } : {},
    });
    
    // Return the usage data with keyId
    return {
      keyId: response.keyId,
      ...response.usage,
    };
  }

  // Usage endpoints
  async getCurrentUsage(merchantId: string, token?: string): Promise<Usage> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<Usage>(`/merchants/${merchantId}/usage/current`, {
      headers,
    });
  }

  async getUsageHistory(
    merchantId: string,
    startDate: string,
    endDate: string,
    token?: string
  ): Promise<Usage[]> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<Usage[]>(
      `/merchants/${merchantId}/usage/history?startDate=${startDate}&endDate=${endDate}`,
      {
        headers,
      }
    );
  }

  // Analytics endpoints
  async getAnalytics(
    merchantId: string,
    startDate?: string,
    endDate?: string,
    token?: string
  ): Promise<Analytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/merchants/${merchantId}/analytics/overview${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.request<Analytics>(url, {
      headers: token ? {
        Authorization: `Bearer ${token}`,
      } : {},
    });

    // Backend returns the overview data directly after unwrapping
    return response;
  }

  async getQueryTimeSeries(
    merchantId: string,
    startDate: string,
    endDate: string,
    groupBy: 'hour' | 'day',
    token?: string
  ): Promise<Array<{ timestamp: string; count: number; avgResponseTime: number; successRate: number }>> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await this.request<{ queries: Array<{ timestamp: string; count: number; avgResponseTime: number; successRate: number }> }>(
      `/merchants/${merchantId}/analytics/queries?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`,
      {
        headers,
      }
    );

    // Backend returns { merchantId, startDate, endDate, groupBy, queries }
    // We need to extract the queries array
    return response.queries || [];
  }

  async getTopQueries(
    merchantId: string,
    limit: number,
    token?: string
  ): Promise<Array<{ query: string; count: number; avgConfidence: number }>> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await this.request<{ topQueries: Array<{ query: string; count: number; avgConfidence: number }> }>(
      `/merchants/${merchantId}/analytics/top-queries?limit=${limit}`,
      {
        headers,
      }
    );

    // Backend returns { merchantId, startDate, endDate, limit, topQueries }
    // We need to extract the topQueries array
    return response.topQueries || [];
  }

  // Billing endpoints
  async getBillingInfo(merchantId: string, token?: string): Promise<BillingInfo> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<BillingInfo>(`/merchants/${merchantId}/billing/current`, {
      headers,
    });
  }

  async subscribe(
    merchantId: string,
    data: {
      plan: 'starter' | 'professional' | 'enterprise';
      paymentMethodId: string;
    },
    token?: string
  ): Promise<BillingInfo> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<BillingInfo>(`/merchants/${merchantId}/billing/subscribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  }

  async upgradePlan(
    merchantId: string,
    data: {
      plan: 'starter' | 'professional' | 'enterprise';
    },
    token?: string
  ): Promise<BillingInfo> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<BillingInfo>(`/merchants/${merchantId}/billing/upgrade`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  }

  async cancelSubscription(merchantId: string, token?: string): Promise<BillingInfo> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<BillingInfo>(`/merchants/${merchantId}/billing/cancel`, {
      method: 'POST',
      headers,
    });
  }

  async getInvoices(merchantId: string, token?: string): Promise<Invoice[]> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await this.request<{ invoices: Invoice[]; limit?: number; offset?: number; total?: number } | Invoice[]>(
      `/merchants/${merchantId}/billing/invoices`,
      {
        headers,
      }
    );
    
    // Handle both array response and object with invoices property
    if (Array.isArray(response)) {
      return response;
    }
    return response.invoices || [];
  }

  async getPaymentMethods(merchantId: string, token?: string): Promise<PaymentMethod[]> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await this.request<PaymentMethod[]>(
      `/merchants/${merchantId}/billing/payment-methods`,
      {
        headers,
      }
    );
    
    // Backend returns array directly after unwrapping
    return Array.isArray(response) ? response : [];
  }

  async addPaymentMethod(
    merchantId: string,
    data: {
      paymentMethodId: string;
      setAsDefault?: boolean;
    },
    token?: string
  ): Promise<PaymentMethod> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<PaymentMethod>(`/merchants/${merchantId}/billing/payment-methods`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  }

  async deletePaymentMethod(
    merchantId: string,
    paymentMethodId: string,
    token?: string
  ): Promise<void> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<void>(
      `/merchants/${merchantId}/billing/payment-methods/${paymentMethodId}`,
      {
        method: 'DELETE',
        headers,
      }
    );
  }

  // Webhook endpoints
  async getWebhooks(merchantId: string, token?: string): Promise<Webhook[]> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await this.request<{ webhooks: Webhook[]; total?: number } | Webhook[]>(
      `/merchants/${merchantId}/webhooks`,
      {
        headers,
      }
    );
    
    // Handle both array response and object with webhooks property
    if (Array.isArray(response)) {
      return response;
    }
    return response.webhooks || [];
  }

  async createWebhook(
    merchantId: string,
    data: {
      url: string;
      events: string[];
    },
    token?: string
  ): Promise<Webhook & { secret: string }> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<Webhook & { secret: string }>(
      `/merchants/${merchantId}/webhooks`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      }
    );
  }

  async updateWebhook(
    merchantId: string,
    webhookId: string,
    data: {
      url?: string;
      events?: string[];
      status?: 'active' | 'disabled';
    },
    token?: string
  ): Promise<Webhook> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<Webhook>(
      `/merchants/${merchantId}/webhooks/${webhookId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      }
    );
  }

  async deleteWebhook(
    merchantId: string,
    webhookId: string,
    token?: string
  ): Promise<void> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<void>(
      `/merchants/${merchantId}/webhooks/${webhookId}`,
      {
        method: 'DELETE',
        headers,
      }
    );
  }

  async testWebhook(
    merchantId: string,
    webhookId: string,
    token?: string
  ): Promise<{ success: boolean; message: string }> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<{ success: boolean; message: string }>(
      `/merchants/${merchantId}/webhooks/${webhookId}/test`,
      {
        method: 'POST',
        headers,
      }
    );
  }

  async getWebhookDeliveries(
    merchantId: string,
    webhookId: string,
    token?: string
  ): Promise<WebhookDelivery[]> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<WebhookDelivery[]>(
      `/merchants/${merchantId}/webhooks/${webhookId}/deliveries`,
      {
        headers,
      }
    );
  }

  // Product Sync endpoints
  async getProductSyncConfig(merchantId: string, token?: string): Promise<ProductSyncConfig | null> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<ProductSyncConfig | null>(`/merchants/${merchantId}/sync/configure`, {
      headers,
    });
  }

  async createProductSyncConfig(
    merchantId: string,
    data: {
      syncType: 'scheduled' | 'webhook' | 'manual';
      schedule?: string;
      sourceType: 'api' | 'ftp' | 's3' | 'csv';
      sourceUrl?: string;
      fieldMapping: Record<string, string>;
    },
    token?: string
  ): Promise<ProductSyncConfig> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<ProductSyncConfig>(`/merchants/${merchantId}/sync/configure`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  }

  async updateProductSyncConfig(
    merchantId: string,
    data: Partial<ProductSyncConfig>,
    token?: string
  ): Promise<ProductSyncConfig> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<ProductSyncConfig>(`/merchants/${merchantId}/sync/configure`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
  }

  async triggerProductSync(merchantId: string, token?: string): Promise<{ syncId: string; message: string }> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<{ syncId: string; message: string }>(
      `/merchants/${merchantId}/sync/trigger`,
      {
        method: 'POST',
        headers,
      }
    );
  }

  async getProductSyncStatus(merchantId: string, token?: string): Promise<{
    status: 'idle' | 'syncing' | 'error';
    lastSync?: ProductSyncHistory;
    nextSync?: string;
  }> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<{
      status: 'idle' | 'syncing' | 'error';
      lastSync?: ProductSyncHistory;
      nextSync?: string;
    }>(`/merchants/${merchantId}/sync/status`, {
      headers,
    });
  }

  async getProductSyncHistory(
    merchantId: string,
    limit?: number,
    token?: string
  ): Promise<ProductSyncHistory[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    
    const queryString = params.toString();
    const url = `/merchants/${merchantId}/sync/history${queryString ? `?${queryString}` : ''}`;
    
    return this.request<ProductSyncHistory[]>(url, {
      headers: token ? {
        Authorization: `Bearer ${token}`,
      } : {},
    });
  }

  async uploadProductFile(
    merchantId: string,
    file: File,
    token?: string
  ): Promise<{ message: string; productsProcessed: number }> {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseUrl}/merchants/${merchantId}/sync/upload`;
    
    // Get access token from session if not provided
    const accessToken = token || await this.getAccessToken();
    
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    const json = await response.json();

    if (!response.ok) {
      // Handle 401 responses
      if (response.status === 401) {
        await getSession();
      }
      throw new Error(json.error || json.message || 'Upload failed');
    }

    if (json.success && json.data !== undefined) {
      return json.data;
    }

    return json;
  }
}

export const apiClient = new ApiClient();
