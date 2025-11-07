/**
 * Unit tests for ApiKeyService
 * Tests API key generation, validation, rotation, and usage tracking
 *
 * Requirements: 3.1, 3.2, 3.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiKeyService } from '../services/ApiKeyService';
import bcrypt from 'bcrypt';

// Mock the repositories
const mockApiKeyRepository = {
  create: vi.fn(),
  findByPrefix: vi.fn(),
  findByKeyId: vi.fn(),
  updateLastUsed: vi.fn(),
  markAsExpired: vi.fn(),
  update: vi.fn(),
  revoke: vi.fn(),
  findByMerchantId: vi.fn(),
  findExpiredKeys: vi.fn(),
};

const mockApiKeyUsageRepository = {
  findByDateRange: vi.fn(),
};

vi.mock('../repositories/ApiKeyRepository', () => ({
  getApiKeyRepository: () => mockApiKeyRepository,
}));

vi.mock('../repositories/ApiKeyUsageRepository', () => ({
  getApiKeyUsageRepository: () => mockApiKeyUsageRepository,
}));

describe('ApiKeyService - generateKey', () => {
  let apiKeyService: ApiKeyService;

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    vi.clearAllMocks();
  });

  it('should generate a production API key with correct prefix', async () => {
    mockApiKeyRepository.create.mockResolvedValue({
      keyId: 'key_abc123',
      merchantId: 'test_merchant',
      name: 'Production Key',
      keyPrefix: 'pk_live_',
      keyHash: 'hashed_value',
      environment: 'production',
      permissions: [],
      status: 'active',
      expiresAt: null,
      createdAt: new Date(),
    });

    const result = await apiKeyService.generateKey({
      merchantId: 'test_merchant',
      name: 'Production Key',
      environment: 'production',
    });

    expect(result.key).toMatch(/^pk_live_/);
    expect(result.prefix).toBe('pk_live_');
    expect(result.environment).toBe('production');
    expect(result.keyId).toMatch(/^key_/);
    expect(mockApiKeyRepository.create).toHaveBeenCalledOnce();
  });

  it('should generate a development API key with correct prefix', async () => {
    mockApiKeyRepository.create.mockResolvedValue({
      keyId: 'key_def456',
      merchantId: 'test_merchant',
      name: 'Dev Key',
      keyPrefix: 'pk_test_',
      keyHash: 'hashed_value',
      environment: 'development',
      permissions: [],
      status: 'active',
      expiresAt: null,
      createdAt: new Date(),
    });

    const result = await apiKeyService.generateKey({
      merchantId: 'test_merchant',
      name: 'Dev Key',
      environment: 'development',
    });

    expect(result.key).toMatch(/^pk_test_/);
    expect(result.prefix).toBe('pk_test_');
    expect(result.environment).toBe('development');
  });

  it('should generate unique keys on multiple calls', async () => {
    mockApiKeyRepository.create.mockResolvedValue({
      keyId: 'key_unique',
      merchantId: 'test_merchant',
      name: 'Test Key',
      keyPrefix: 'pk_test_',
      keyHash: 'hashed_value',
      environment: 'development',
      permissions: [],
      status: 'active',
      expiresAt: null,
      createdAt: new Date(),
    });

    const result1 = await apiKeyService.generateKey({
      merchantId: 'test_merchant',
      name: 'Key 1',
      environment: 'development',
    });

    const result2 = await apiKeyService.generateKey({
      merchantId: 'test_merchant',
      name: 'Key 2',
      environment: 'development',
    });

    expect(result1.key).not.toBe(result2.key);
    expect(result1.keyId).not.toBe(result2.keyId);
  });

  it('should set expiration date when expiresInDays is provided', async () => {
    const expiresInDays = 30;
    mockApiKeyRepository.create.mockResolvedValue({
      keyId: 'key_expires',
      merchantId: 'test_merchant',
      name: 'Expiring Key',
      keyPrefix: 'pk_test_',
      keyHash: 'hashed_value',
      environment: 'development',
      permissions: [],
      status: 'active',
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });

    const result = await apiKeyService.generateKey({
      merchantId: 'test_merchant',
      name: 'Expiring Key',
      environment: 'development',
      expiresInDays,
    });

    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('should store permissions when provided', async () => {
    const permissions = ['chat:read', 'documents:write'];
    
    mockApiKeyRepository.create.mockImplementation((data) => {
      expect(data.permissions).toEqual(permissions);
      return Promise.resolve({
        keyId: 'key_perms',
        merchantId: 'test_merchant',
        name: 'Key with Permissions',
        keyPrefix: 'pk_test_',
        keyHash: 'hashed_value',
        environment: 'development',
        permissions,
        status: 'active',
        expiresAt: null,
        createdAt: new Date(),
      });
    });

    await apiKeyService.generateKey({
      merchantId: 'test_merchant',
      name: 'Key with Permissions',
      environment: 'development',
      permissions,
    });

    expect(mockApiKeyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions,
      })
    );
  });

  it('should hash the API key before storing', async () => {
    mockApiKeyRepository.create.mockImplementation(async (data) => {
      // Verify that keyHash is a bcrypt hash
      expect(data.keyHash).toBeTruthy();
      expect(data.keyHash.length).toBeGreaterThan(50); // bcrypt hashes are long
      
      return {
        keyId: 'key_hashed',
        merchantId: 'test_merchant',
        name: 'Hashed Key',
        keyPrefix: 'pk_test_',
        keyHash: data.keyHash,
        environment: 'development',
        permissions: [],
        status: 'active',
        expiresAt: null,
        createdAt: new Date(),
      };
    });

    const result = await apiKeyService.generateKey({
      merchantId: 'test_merchant',
      name: 'Hashed Key',
      environment: 'development',
    });

    // The returned key should be plaintext
    expect(result.key).toMatch(/^pk_test_/);
    expect(mockApiKeyRepository.create).toHaveBeenCalledOnce();
  });
});

describe('ApiKeyService - validateKey', () => {
  let apiKeyService: ApiKeyService;

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    vi.clearAllMocks();
  });

  it('should validate a correct active API key', async () => {
    const testKey = 'pk_test_abcdef123456';
    const hashedKey = await bcrypt.hash(testKey, 10);

    mockApiKeyRepository.findByPrefix.mockResolvedValue([
      {
        keyId: 'key_valid',
        merchantId: 'test_merchant',
        name: 'Valid Key',
        keyPrefix: 'pk_test_',
        keyHash: hashedKey,
        environment: 'development',
        permissions: ['chat:read'],
        status: 'active',
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      },
    ]);

    mockApiKeyRepository.updateLastUsed.mockResolvedValue(undefined);

    const result = await apiKeyService.validateKey(testKey);

    expect(result.valid).toBe(true);
    expect(result.merchantId).toBe('test_merchant');
    expect(result.keyId).toBe('key_valid');
    expect(result.permissions).toEqual(['chat:read']);
    expect(mockApiKeyRepository.updateLastUsed).toHaveBeenCalledWith('key_valid');
  });

  it('should reject an invalid API key', async () => {
    mockApiKeyRepository.findByPrefix.mockResolvedValue([]);

    const result = await apiKeyService.validateKey('pk_test_invalid');

    expect(result.valid).toBe(false);
    expect(result.merchantId).toBeUndefined();
    expect(result.keyId).toBeUndefined();
  });

  it('should reject an expired API key', async () => {
    const testKey = 'pk_test_expired123';
    const hashedKey = await bcrypt.hash(testKey, 10);
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

    mockApiKeyRepository.findByPrefix.mockResolvedValue([
      {
        keyId: 'key_expired',
        merchantId: 'test_merchant',
        name: 'Expired Key',
        keyPrefix: 'pk_test_',
        keyHash: hashedKey,
        environment: 'development',
        permissions: [],
        status: 'active',
        expiresAt: expiredDate,
        lastUsedAt: null,
        createdAt: new Date(),
      },
    ]);

    mockApiKeyRepository.markAsExpired.mockResolvedValue({
      keyId: 'key_expired',
      status: 'expired',
    } as any);

    const result = await apiKeyService.validateKey(testKey);

    expect(result.valid).toBe(false);
    expect(mockApiKeyRepository.markAsExpired).toHaveBeenCalledWith('key_expired');
  });

  it('should reject a revoked API key', async () => {
    const testKey = 'pk_test_revoked123';
    const hashedKey = await bcrypt.hash(testKey, 10);

    mockApiKeyRepository.findByPrefix.mockResolvedValue([
      {
        keyId: 'key_revoked',
        merchantId: 'test_merchant',
        name: 'Revoked Key',
        keyPrefix: 'pk_test_',
        keyHash: hashedKey,
        environment: 'development',
        permissions: [],
        status: 'revoked',
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      },
    ]);

    const result = await apiKeyService.validateKey(testKey);

    expect(result.valid).toBe(false);
  });

  it('should handle multiple keys with same prefix', async () => {
    const correctKey = 'pk_test_correct123';
    const correctHash = await bcrypt.hash(correctKey, 10);
    const wrongHash = await bcrypt.hash('pk_test_wrong456', 10);

    mockApiKeyRepository.findByPrefix.mockResolvedValue([
      {
        keyId: 'key_wrong',
        merchantId: 'merchant_1',
        keyHash: wrongHash,
        keyPrefix: 'pk_test_',
        status: 'active',
        expiresAt: null,
      },
      {
        keyId: 'key_correct',
        merchantId: 'merchant_2',
        keyHash: correctHash,
        keyPrefix: 'pk_test_',
        status: 'active',
        expiresAt: null,
        permissions: ['*'],
      },
    ] as any);

    mockApiKeyRepository.updateLastUsed.mockResolvedValue(undefined);

    const result = await apiKeyService.validateKey(correctKey);

    expect(result.valid).toBe(true);
    expect(result.merchantId).toBe('merchant_2');
    expect(result.keyId).toBe('key_correct');
  });
});

describe('ApiKeyService - listKeys', () => {
  let apiKeyService: ApiKeyService;

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    vi.clearAllMocks();
  });

  it('should list active keys by default', async () => {
    const mockKeys = [
      {
        keyId: 'key_1',
        merchantId: 'test_merchant',
        name: 'Key 1',
        status: 'active',
      },
      {
        keyId: 'key_2',
        merchantId: 'test_merchant',
        name: 'Key 2',
        status: 'active',
      },
    ];

    mockApiKeyRepository.findByMerchantId.mockResolvedValue(mockKeys as any);

    const result = await apiKeyService.listKeys('test_merchant');

    expect(result).toHaveLength(2);
    expect(mockApiKeyRepository.findByMerchantId).toHaveBeenCalledWith(
      'test_merchant',
      false
    );
  });

  it('should include revoked keys when requested', async () => {
    const mockKeys = [
      {
        keyId: 'key_1',
        merchantId: 'test_merchant',
        name: 'Active Key',
        status: 'active',
      },
      {
        keyId: 'key_2',
        merchantId: 'test_merchant',
        name: 'Revoked Key',
        status: 'revoked',
      },
    ];

    mockApiKeyRepository.findByMerchantId.mockResolvedValue(mockKeys as any);

    const result = await apiKeyService.listKeys('test_merchant', true);

    expect(result).toHaveLength(2);
    expect(mockApiKeyRepository.findByMerchantId).toHaveBeenCalledWith(
      'test_merchant',
      true
    );
  });
});

describe('ApiKeyService - revokeKey', () => {
  let apiKeyService: ApiKeyService;

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    vi.clearAllMocks();
  });

  it('should revoke an API key', async () => {
    const revokedKey = {
      keyId: 'key_to_revoke',
      merchantId: 'test_merchant',
      name: 'Key to Revoke',
      status: 'revoked',
      updatedAt: new Date(),
    };

    mockApiKeyRepository.revoke.mockResolvedValue(revokedKey as any);

    const result = await apiKeyService.revokeKey('key_to_revoke');

    expect(result.status).toBe('revoked');
    expect(mockApiKeyRepository.revoke).toHaveBeenCalledWith('key_to_revoke');
  });
});

describe('ApiKeyService - rotateKey', () => {
  let apiKeyService: ApiKeyService;

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    vi.clearAllMocks();
  });

  it('should rotate an API key with grace period', async () => {
    const existingKey = {
      keyId: 'key_old',
      merchantId: 'test_merchant',
      name: 'Old Key',
      keyPrefix: 'pk_test_',
      environment: 'development',
      permissions: ['chat:read'],
      status: 'active',
      expiresAt: null,
    };

    mockApiKeyRepository.findByKeyId.mockResolvedValue(existingKey as any);
    mockApiKeyRepository.create.mockImplementation((data) => {
      return Promise.resolve({
        keyId: data.keyId, // Use the generated keyId
        merchantId: data.merchantId,
        name: data.name,
        keyPrefix: data.keyPrefix,
        keyHash: data.keyHash,
        environment: data.environment,
        permissions: data.permissions,
        status: 'active',
        expiresAt: data.expiresAt,
        createdAt: new Date(),
      } as any);
    });
    mockApiKeyRepository.update.mockResolvedValue({} as any);

    const result = await apiKeyService.rotateKey('key_old', 7);

    expect(result.keyId).toMatch(/^key_/); // Check pattern instead of exact value
    expect(result.key).toMatch(/^pk_test_/);
    expect(mockApiKeyRepository.update).toHaveBeenCalledWith(
      'key_old',
      expect.objectContaining({
        name: 'Old Key (deprecated)',
      })
    );
  });

  it('should throw error when rotating non-existent key', async () => {
    mockApiKeyRepository.findByKeyId.mockResolvedValue(null);

    await expect(apiKeyService.rotateKey('key_nonexistent')).rejects.toThrow(
      'API key not found'
    );
  });

  it('should preserve permissions when rotating', async () => {
    const existingKey = {
      keyId: 'key_old',
      merchantId: 'test_merchant',
      name: 'Old Key',
      keyPrefix: 'pk_live_',
      environment: 'production',
      permissions: ['chat:read', 'documents:write'],
      status: 'active',
      expiresAt: null,
    };

    mockApiKeyRepository.findByKeyId.mockResolvedValue(existingKey as any);
    mockApiKeyRepository.create.mockImplementation((data) => {
      expect(data.permissions).toEqual(['chat:read', 'documents:write']);
      return Promise.resolve({
        keyId: 'key_new',
        ...data,
        createdAt: new Date(),
      } as any);
    });
    mockApiKeyRepository.update.mockResolvedValue({} as any);

    await apiKeyService.rotateKey('key_old');

    expect(mockApiKeyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: ['chat:read', 'documents:write'],
      })
    );
  });
});

describe('ApiKeyService - getKeyUsage', () => {
  let apiKeyService: ApiKeyService;

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    vi.clearAllMocks();
  });

  it('should return usage statistics for an API key', async () => {
    const mockKey = {
      keyId: 'key_usage',
      merchantId: 'test_merchant',
      lastUsedAt: new Date(),
    };

    const mockUsageRecords = [
      {
        keyId: 'key_usage',
        endpoint: '/api/chat',
        method: 'POST',
        statusCode: 200,
        responseTimeMs: 150,
        timestamp: new Date(),
      },
      {
        keyId: 'key_usage',
        endpoint: '/api/documents',
        method: 'GET',
        statusCode: 200,
        responseTimeMs: 100,
        timestamp: new Date(),
      },
      {
        keyId: 'key_usage',
        endpoint: '/api/chat',
        method: 'POST',
        statusCode: 500,
        responseTimeMs: 200,
        timestamp: new Date(),
      },
    ];

    mockApiKeyRepository.findByKeyId.mockResolvedValue(mockKey as any);
    mockApiKeyUsageRepository.findByDateRange.mockResolvedValue(mockUsageRecords as any);

    const result = await apiKeyService.getKeyUsage('key_usage');

    expect(result.totalRequests).toBe(3);
    expect(result.requestsByEndpoint['/api/chat']).toBe(2);
    expect(result.requestsByEndpoint['/api/documents']).toBe(1);
    expect(result.requestsByStatus['200xx']).toBe(2);
    expect(result.requestsByStatus['500xx']).toBe(1);
    expect(result.avgResponseTime).toBe(150); // (150 + 100 + 200) / 3
    expect(result.lastUsed).toEqual(mockKey.lastUsedAt);
  });

  it('should throw error for non-existent key', async () => {
    mockApiKeyRepository.findByKeyId.mockResolvedValue(null);

    await expect(apiKeyService.getKeyUsage('key_nonexistent')).rejects.toThrow(
      'API key not found'
    );
  });

  it('should handle empty usage records', async () => {
    const mockKey = {
      keyId: 'key_unused',
      merchantId: 'test_merchant',
      lastUsedAt: null,
    };

    mockApiKeyRepository.findByKeyId.mockResolvedValue(mockKey as any);
    mockApiKeyUsageRepository.findByDateRange.mockResolvedValue([]);

    const result = await apiKeyService.getKeyUsage('key_unused');

    expect(result.totalRequests).toBe(0);
    expect(result.requestsByEndpoint).toEqual({});
    expect(result.requestsByStatus).toEqual({});
    expect(result.avgResponseTime).toBe(0);
    expect(result.lastUsed).toBeNull();
  });

  it('should use custom date range when provided', async () => {
    const mockKey = {
      keyId: 'key_usage',
      merchantId: 'test_merchant',
      lastUsedAt: new Date(),
    };

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    mockApiKeyRepository.findByKeyId.mockResolvedValue(mockKey as any);
    mockApiKeyUsageRepository.findByDateRange.mockResolvedValue([]);

    await apiKeyService.getKeyUsage('key_usage', startDate, endDate);

    expect(mockApiKeyUsageRepository.findByDateRange).toHaveBeenCalledWith(
      'key_usage',
      startDate,
      endDate
    );
  });
});

describe('ApiKeyService - processExpiredKeys', () => {
  let apiKeyService: ApiKeyService;

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    vi.clearAllMocks();
  });

  it('should mark expired keys as expired', async () => {
    const expiredKeys = [
      { keyId: 'key_exp1', status: 'active' },
      { keyId: 'key_exp2', status: 'active' },
      { keyId: 'key_exp3', status: 'active' },
    ];

    mockApiKeyRepository.findExpiredKeys.mockResolvedValue(expiredKeys as any);
    mockApiKeyRepository.markAsExpired.mockResolvedValue({} as any);

    const count = await apiKeyService.processExpiredKeys();

    expect(count).toBe(3);
    expect(mockApiKeyRepository.markAsExpired).toHaveBeenCalledTimes(3);
    expect(mockApiKeyRepository.markAsExpired).toHaveBeenCalledWith('key_exp1');
    expect(mockApiKeyRepository.markAsExpired).toHaveBeenCalledWith('key_exp2');
    expect(mockApiKeyRepository.markAsExpired).toHaveBeenCalledWith('key_exp3');
  });

  it('should return 0 when no expired keys found', async () => {
    mockApiKeyRepository.findExpiredKeys.mockResolvedValue([]);

    const count = await apiKeyService.processExpiredKeys();

    expect(count).toBe(0);
    expect(mockApiKeyRepository.markAsExpired).not.toHaveBeenCalled();
  });
});
