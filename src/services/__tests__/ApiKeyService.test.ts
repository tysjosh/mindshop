import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiKeyService } from '../ApiKeyService';
import { getApiKeyRepository } from '../../repositories/ApiKeyRepository';
import { getApiKeyUsageRepository } from '../../repositories/ApiKeyUsageRepository';
import bcrypt from 'bcrypt';

// Mock the repositories
vi.mock('../../repositories/ApiKeyRepository');
vi.mock('../../repositories/ApiKeyUsageRepository');
vi.mock('bcrypt');

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;
  let mockApiKeyRepository: any;
  let mockApiKeyUsageRepository: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock repository instances
    mockApiKeyRepository = {
      create: vi.fn(),
      findByPrefix: vi.fn(),
      findByKeyId: vi.fn(),
      findByMerchantId: vi.fn(),
      updateLastUsed: vi.fn(),
      markAsExpired: vi.fn(),
      revoke: vi.fn(),
      update: vi.fn(),
      findExpiredKeys: vi.fn(),
    };

    mockApiKeyUsageRepository = {
      findByDateRange: vi.fn(),
    };

    // Mock the repository getters
    vi.mocked(getApiKeyRepository).mockReturnValue(mockApiKeyRepository);
    vi.mocked(getApiKeyUsageRepository).mockReturnValue(mockApiKeyUsageRepository);

    // Create service instance
    apiKeyService = new ApiKeyService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateKey', () => {
    it('should generate a new API key with correct prefix for production', async () => {
      const mockHash = 'hashed_key_value';
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      mockApiKeyRepository.create.mockResolvedValue({
        keyId: 'key_abc123',
        merchantId: 'merchant_123',
        name: 'Test Key',
        keyPrefix: 'pk_live_',
        keyHash: mockHash,
        environment: 'production',
        permissions: [],
        status: 'active',
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await apiKeyService.generateKey({
        merchantId: 'merchant_123',
        name: 'Test Key',
        environment: 'production',
      });

      expect(result.prefix).toBe('pk_live_');
      expect(result.key).toMatch(/^pk_live_[a-f0-9]{64}$/);
      expect(result.environment).toBe('production');
      expect(result.keyId).toMatch(/^key_[a-f0-9]{32}$/);
      expect(mockApiKeyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId: 'merchant_123',
          name: 'Test Key',
          keyPrefix: 'pk_live_',
          environment: 'production',
        })
      );
    });

    it('should generate a new API key with correct prefix for development', async () => {
      const mockHash = 'hashed_key_value';
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      mockApiKeyRepository.create.mockResolvedValue({
        keyId: 'key_abc123',
        merchantId: 'merchant_123',
        name: 'Test Key',
        keyPrefix: 'pk_test_',
        keyHash: mockHash,
        environment: 'development',
        permissions: [],
        status: 'active',
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await apiKeyService.generateKey({
        merchantId: 'merchant_123',
        name: 'Test Key',
        environment: 'development',
      });

      expect(result.prefix).toBe('pk_test_');
      expect(result.key).toMatch(/^pk_test_[a-f0-9]{64}$/);
      expect(result.environment).toBe('development');
    });

    it('should set expiration date when expiresInDays is provided', async () => {
      const mockHash = 'hashed_key_value';
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const expiresInDays = 30;
      const expectedExpiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      mockApiKeyRepository.create.mockResolvedValue({
        keyId: 'key_abc123',
        merchantId: 'merchant_123',
        name: 'Test Key',
        keyPrefix: 'pk_live_',
        keyHash: mockHash,
        environment: 'production',
        permissions: [],
        status: 'active',
        expiresAt: expectedExpiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await apiKeyService.generateKey({
        merchantId: 'merchant_123',
        name: 'Test Key',
        environment: 'production',
        expiresInDays,
      });

      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockApiKeyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Date),
        })
      );
    });

    it('should include custom permissions when provided', async () => {
      const mockHash = 'hashed_key_value';
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const permissions = ['chat:read', 'documents:write'];

      mockApiKeyRepository.create.mockResolvedValue({
        keyId: 'key_abc123',
        merchantId: 'merchant_123',
        name: 'Test Key',
        keyPrefix: 'pk_live_',
        keyHash: mockHash,
        environment: 'production',
        permissions,
        status: 'active',
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await apiKeyService.generateKey({
        merchantId: 'merchant_123',
        name: 'Test Key',
        environment: 'production',
        permissions,
      });

      expect(mockApiKeyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions,
        })
      );
    });
  });

  describe('validateKey', () => {
    it('should return valid result for a valid active key', async () => {
      const testKey = 'pk_live_abc123def456';
      const mockApiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_123',
        keyHash: 'hashed_value',
        keyPrefix: 'pk_live_',
        status: 'active',
        expiresAt: null,
        permissions: ['chat:read'],
      };

      mockApiKeyRepository.findByPrefix.mockResolvedValue([mockApiKey]);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await apiKeyService.validateKey(testKey);

      expect(result.valid).toBe(true);
      expect(result.merchantId).toBe('merchant_123');
      expect(result.keyId).toBe('key_123');
      expect(result.permissions).toEqual(['chat:read']);
      expect(mockApiKeyRepository.updateLastUsed).toHaveBeenCalledWith('key_123');
    });

    it('should return invalid result for expired key', async () => {
      const testKey = 'pk_live_abc123def456';
      const expiredDate = new Date(Date.now() - 1000);
      const mockApiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_123',
        keyHash: 'hashed_value',
        keyPrefix: 'pk_live_',
        status: 'active',
        expiresAt: expiredDate,
        permissions: [],
      };

      mockApiKeyRepository.findByPrefix.mockResolvedValue([mockApiKey]);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await apiKeyService.validateKey(testKey);

      expect(result.valid).toBe(false);
      expect(mockApiKeyRepository.markAsExpired).toHaveBeenCalledWith('key_123');
    });

    it('should return invalid result for revoked key', async () => {
      const testKey = 'pk_live_abc123def456';
      const mockApiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_123',
        keyHash: 'hashed_value',
        keyPrefix: 'pk_live_',
        status: 'revoked',
        expiresAt: null,
        permissions: [],
      };

      mockApiKeyRepository.findByPrefix.mockResolvedValue([mockApiKey]);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await apiKeyService.validateKey(testKey);

      expect(result.valid).toBe(false);
      expect(mockApiKeyRepository.updateLastUsed).not.toHaveBeenCalled();
    });

    it('should return invalid result when key hash does not match', async () => {
      const testKey = 'pk_live_abc123def456';
      const mockApiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_123',
        keyHash: 'hashed_value',
        keyPrefix: 'pk_live_',
        status: 'active',
        expiresAt: null,
        permissions: [],
      };

      mockApiKeyRepository.findByPrefix.mockResolvedValue([mockApiKey]);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await apiKeyService.validateKey(testKey);

      expect(result.valid).toBe(false);
    });

    it('should return invalid result when no keys found with prefix', async () => {
      const testKey = 'pk_live_abc123def456';

      mockApiKeyRepository.findByPrefix.mockResolvedValue([]);

      const result = await apiKeyService.validateKey(testKey);

      expect(result.valid).toBe(false);
    });
  });

  describe('listKeys', () => {
    it('should return all active keys for a merchant', async () => {
      const mockKeys = [
        { keyId: 'key_1', merchantId: 'merchant_123', status: 'active' },
        { keyId: 'key_2', merchantId: 'merchant_123', status: 'active' },
      ];

      mockApiKeyRepository.findByMerchantId.mockResolvedValue(mockKeys);

      const result = await apiKeyService.listKeys('merchant_123');

      expect(result).toEqual(mockKeys);
      expect(mockApiKeyRepository.findByMerchantId).toHaveBeenCalledWith('merchant_123', false);
    });

    it('should include revoked keys when requested', async () => {
      const mockKeys = [
        { keyId: 'key_1', merchantId: 'merchant_123', status: 'active' },
        { keyId: 'key_2', merchantId: 'merchant_123', status: 'revoked' },
      ];

      mockApiKeyRepository.findByMerchantId.mockResolvedValue(mockKeys);

      const result = await apiKeyService.listKeys('merchant_123', true);

      expect(result).toEqual(mockKeys);
      expect(mockApiKeyRepository.findByMerchantId).toHaveBeenCalledWith('merchant_123', true);
    });
  });

  describe('revokeKey', () => {
    it('should revoke an API key', async () => {
      const mockRevokedKey = {
        keyId: 'key_123',
        merchantId: 'merchant_123',
        status: 'revoked',
      };

      mockApiKeyRepository.revoke.mockResolvedValue(mockRevokedKey);

      const result = await apiKeyService.revokeKey('key_123');

      expect(result).toEqual(mockRevokedKey);
      expect(mockApiKeyRepository.revoke).toHaveBeenCalledWith('key_123');
    });
  });

  describe('rotateKey', () => {
    it('should generate new key and deprecate old one with grace period', async () => {
      const existingKey = {
        keyId: 'key_old',
        merchantId: 'merchant_123',
        name: 'Old Key',
        environment: 'production' as const,
        permissions: ['chat:read'],
        expiresAt: null,
        keyPrefix: 'pk_live_',
        keyHash: 'old_hash',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockHash = 'new_hashed_key_value';
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      mockApiKeyRepository.findByKeyId.mockResolvedValue(existingKey);
      mockApiKeyRepository.create.mockResolvedValue({
        keyId: 'key_new',
        merchantId: 'merchant_123',
        name: 'Old Key (rotated)',
        keyPrefix: 'pk_live_',
        keyHash: mockHash,
        environment: 'production',
        permissions: ['chat:read'],
        status: 'active',
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockApiKeyRepository.update.mockResolvedValue(existingKey);

      const result = await apiKeyService.rotateKey('key_old', 7);

      expect(result.keyId).toMatch(/^key_[a-f0-9]{32}$/);
      expect(result.key).toMatch(/^pk_live_[a-f0-9]{64}$/);
      expect(mockApiKeyRepository.update).toHaveBeenCalledWith(
        'key_old',
        expect.objectContaining({
          expiresAt: expect.any(Date),
          name: 'Old Key (deprecated)',
        })
      );
    });

    it('should throw error if key not found', async () => {
      mockApiKeyRepository.findByKeyId.mockResolvedValue(null);

      await expect(apiKeyService.rotateKey('key_nonexistent')).rejects.toThrow('API key not found');
    });
  });

  describe('getKeyUsage', () => {
    it('should return usage statistics for an API key', async () => {
      const mockApiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_123',
        lastUsedAt: new Date('2025-01-01'),
      };

      const mockUsageRecords = [
        {
          keyId: 'key_123',
          endpoint: '/api/chat',
          statusCode: 200,
          responseTimeMs: 100,
        },
        {
          keyId: 'key_123',
          endpoint: '/api/chat',
          statusCode: 200,
          responseTimeMs: 150,
        },
        {
          keyId: 'key_123',
          endpoint: '/api/documents',
          statusCode: 404,
          responseTimeMs: 50,
        },
      ];

      mockApiKeyRepository.findByKeyId.mockResolvedValue(mockApiKey);
      mockApiKeyUsageRepository.findByDateRange.mockResolvedValue(mockUsageRecords);

      const result = await apiKeyService.getKeyUsage('key_123');

      expect(result.totalRequests).toBe(3);
      expect(result.requestsByEndpoint).toEqual({
        '/api/chat': 2,
        '/api/documents': 1,
      });
      expect(result.requestsByStatus).toEqual({
        '200xx': 2,
        '400xx': 1,
      });
      expect(result.avgResponseTime).toBe(100); // (100 + 150 + 50) / 3 = 100
      expect(result.lastUsed).toEqual(new Date('2025-01-01'));
    });

    it('should throw error if key not found', async () => {
      mockApiKeyRepository.findByKeyId.mockResolvedValue(null);

      await expect(apiKeyService.getKeyUsage('key_nonexistent')).rejects.toThrow('API key not found');
    });

    it('should handle empty usage records', async () => {
      const mockApiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_123',
        lastUsedAt: null,
      };

      mockApiKeyRepository.findByKeyId.mockResolvedValue(mockApiKey);
      mockApiKeyUsageRepository.findByDateRange.mockResolvedValue([]);

      const result = await apiKeyService.getKeyUsage('key_123');

      expect(result.totalRequests).toBe(0);
      expect(result.requestsByEndpoint).toEqual({});
      expect(result.requestsByStatus).toEqual({});
      expect(result.avgResponseTime).toBe(0);
      expect(result.lastUsed).toBeNull();
    });
  });

  describe('processExpiredKeys', () => {
    it('should mark all expired keys', async () => {
      const expiredKeys = [
        { keyId: 'key_1', status: 'active' },
        { keyId: 'key_2', status: 'active' },
        { keyId: 'key_3', status: 'active' },
      ];

      mockApiKeyRepository.findExpiredKeys.mockResolvedValue(expiredKeys);
      mockApiKeyRepository.markAsExpired.mockResolvedValue({} as any);

      const count = await apiKeyService.processExpiredKeys();

      expect(count).toBe(3);
      expect(mockApiKeyRepository.markAsExpired).toHaveBeenCalledTimes(3);
      expect(mockApiKeyRepository.markAsExpired).toHaveBeenCalledWith('key_1');
      expect(mockApiKeyRepository.markAsExpired).toHaveBeenCalledWith('key_2');
      expect(mockApiKeyRepository.markAsExpired).toHaveBeenCalledWith('key_3');
    });

    it('should return 0 when no expired keys found', async () => {
      mockApiKeyRepository.findExpiredKeys.mockResolvedValue([]);

      const count = await apiKeyService.processExpiredKeys();

      expect(count).toBe(0);
      expect(mockApiKeyRepository.markAsExpired).not.toHaveBeenCalled();
    });
  });
});
