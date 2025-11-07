import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getApiKeyRepository } from '../repositories/ApiKeyRepository';
import { getApiKeyUsageRepository } from '../repositories/ApiKeyUsageRepository';
import type { ApiKey, NewApiKey } from '../database/schema';

export interface GenerateKeyData {
  merchantId: string;
  name: string;
  environment: 'development' | 'production';
  permissions?: string[];
  expiresInDays?: number;
}

export interface GenerateKeyResult {
  keyId: string;
  key: string;
  prefix: string;
  environment: 'development' | 'production';
  expiresAt: Date | null;
}

export interface ValidateKeyResult {
  valid: boolean;
  merchantId?: string;
  keyId?: string;
  permissions?: string[];
}

export interface KeyUsageStats {
  totalRequests: number;
  requestsByEndpoint: Record<string, number>;
  requestsByStatus: Record<string, number>;
  avgResponseTime: number;
  lastUsed: Date | null;
}

export class ApiKeyService {
  private apiKeyRepository = getApiKeyRepository();
  private apiKeyUsageRepository = getApiKeyUsageRepository();

  /**
   * Generate a new API key for a merchant
   */
  async generateKey(data: GenerateKeyData): Promise<GenerateKeyResult> {
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
    const apiKeyData: NewApiKey = {
      keyId,
      merchantId: data.merchantId,
      name: data.name,
      keyPrefix: prefix,
      keyHash,
      environment: data.environment,
      permissions: data.permissions || [],
      expiresAt,
    };

    await this.apiKeyRepository.create(apiKeyData);

    // 5. Return full key (only time it's shown)
    return {
      keyId,
      key: fullKey,
      prefix,
      environment: data.environment,
      expiresAt,
    };
  }

  /**
   * Validate an API key and return merchant information
   */
  async validateKey(key: string): Promise<ValidateKeyResult> {
    // 1. Extract prefix
    const prefix = key.substring(0, 8); // 'pk_live_' or 'pk_test_'

    // 2. Find keys with matching prefix
    const apiKeys = await this.apiKeyRepository.findByPrefix(prefix);

    // 3. Check each key hash
    for (const apiKey of apiKeys) {
      const isMatch = await bcrypt.compare(key, apiKey.keyHash);

      if (isMatch) {
        // Check if expired
        if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
          // Mark as expired if not already
          if (apiKey.status === 'active') {
            await this.apiKeyRepository.markAsExpired(apiKey.keyId);
          }
          return { valid: false };
        }

        // Check if revoked
        if (apiKey.status !== 'active') {
          return { valid: false };
        }

        // Update last used timestamp
        await this.apiKeyRepository.updateLastUsed(apiKey.keyId);

        return {
          valid: true,
          merchantId: apiKey.merchantId,
          keyId: apiKey.keyId,
          permissions: apiKey.permissions as string[],
        };
      }
    }

    return { valid: false };
  }

  /**
   * List all API keys for a merchant
   */
  async listKeys(merchantId: string, includeRevoked: boolean = false): Promise<ApiKey[]> {
    return this.apiKeyRepository.findByMerchantId(merchantId, includeRevoked);
  }

  /**
   * Revoke an API key
   */
  async revokeKey(keyId: string): Promise<ApiKey> {
    return this.apiKeyRepository.revoke(keyId);
  }

  /**
   * Rotate an API key (generate new key, deprecate old one with grace period)
   */
  async rotateKey(keyId: string, gracePeriodDays: number = 7): Promise<GenerateKeyResult> {
    // 1. Get existing key
    const existingKey = await this.apiKeyRepository.findByKeyId(keyId);
    if (!existingKey) {
      throw new Error('API key not found');
    }

    // 2. Generate new key with same settings
    const newKey = await this.generateKey({
      merchantId: existingKey.merchantId,
      name: `${existingKey.name} (rotated)`,
      environment: existingKey.environment,
      permissions: existingKey.permissions as string[],
      expiresInDays: existingKey.expiresAt
        ? Math.ceil((existingKey.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : undefined,
    });

    // 3. Set expiration on old key (grace period)
    const expiresAt = new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000);
    await this.apiKeyRepository.update(keyId, {
      expiresAt,
      name: `${existingKey.name} (deprecated)`,
    });

    return newKey;
  }

  /**
   * Get usage statistics for an API key
   */
  async getKeyUsage(keyId: string, startDate?: Date, endDate?: Date): Promise<KeyUsageStats> {
    const apiKey = await this.apiKeyRepository.findByKeyId(keyId);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    // Set default date range if not provided (last 30 days)
    const end = endDate || new Date();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get usage records
    const usageRecords = await this.apiKeyUsageRepository.findByDateRange(
      keyId,
      start,
      end
    );

    // Calculate statistics
    const totalRequests = usageRecords.length;
    const requestsByEndpoint: Record<string, number> = {};
    const requestsByStatus: Record<string, number> = {};
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const record of usageRecords) {
      // Count by endpoint
      requestsByEndpoint[record.endpoint] = (requestsByEndpoint[record.endpoint] || 0) + 1;

      // Count by status
      const statusGroup = Math.floor(record.statusCode / 100) * 100;
      const statusKey = `${statusGroup}xx`;
      requestsByStatus[statusKey] = (requestsByStatus[statusKey] || 0) + 1;

      // Sum response times
      if (record.responseTimeMs) {
        totalResponseTime += record.responseTimeMs;
        responseTimeCount++;
      }
    }

    const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    return {
      totalRequests,
      requestsByEndpoint,
      requestsByStatus,
      avgResponseTime: Math.round(avgResponseTime),
      lastUsed: apiKey.lastUsedAt,
    };
  }

  /**
   * Check for expired keys and mark them
   */
  async processExpiredKeys(): Promise<number> {
    const expiredKeys = await this.apiKeyRepository.findExpiredKeys();
    let count = 0;

    for (const key of expiredKeys) {
      await this.apiKeyRepository.markAsExpired(key.keyId);
      count++;
    }

    return count;
  }

  /**
   * Generate a random string for key generation
   */
  private generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }
}

// Export singleton instance
let apiKeyServiceInstance: ApiKeyService | null = null;

export const getApiKeyService = (): ApiKeyService => {
  if (!apiKeyServiceInstance) {
    apiKeyServiceInstance = new ApiKeyService();
  }
  return apiKeyServiceInstance;
};
