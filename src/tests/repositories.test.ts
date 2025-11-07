import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MerchantRepository } from '../repositories/MerchantRepository';
import { ApiKeyRepository } from '../repositories/ApiKeyRepository';
import { MerchantSettingsRepository } from '../repositories/MerchantSettingsRepository';
import { db } from '../database/connection';
import type { NewMerchant, NewApiKey, NewMerchantSettings } from '../database/schema';

describe('Repository CRUD Operations', () => {
  let merchantRepo: MerchantRepository;
  let apiKeyRepo: ApiKeyRepository;
  let settingsRepo: MerchantSettingsRepository;

  // Test data
  const testMerchantId = 'test_merchant_crud_001';
  const testEmail = 'crud-test@example.com';
  const testCognitoUserId = 'cognito-crud-test-001';

  beforeAll(async () => {
    merchantRepo = new MerchantRepository();
    apiKeyRepo = new ApiKeyRepository();
    settingsRepo = new MerchantSettingsRepository();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    try {
      await merchantRepo.delete(testMerchantId);
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  afterAll(async () => {
    // Final cleanup
    try {
      await merchantRepo.delete(testMerchantId);
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  describe('MerchantRepository', () => {
    it('should create a new merchant', async () => {
      const newMerchant: NewMerchant = {
        merchantId: testMerchantId,
        cognitoUserId: testCognitoUserId,
        email: testEmail,
        companyName: 'Test Company CRUD',
        website: 'https://test-crud.com',
        industry: 'Technology',
        status: 'pending_verification',
        plan: 'starter',
      };

      const merchant = await merchantRepo.create(newMerchant);

      expect(merchant).toBeDefined();
      expect(merchant.merchantId).toBe(testMerchantId);
      expect(merchant.email).toBe(testEmail);
      expect(merchant.companyName).toBe('Test Company CRUD');
      expect(merchant.status).toBe('pending_verification');
      expect(merchant.plan).toBe('starter');
    });

    it('should find merchant by merchantId', async () => {
      // Create merchant first
      await merchantRepo.create({
        merchantId: testMerchantId,
        cognitoUserId: testCognitoUserId,
        email: testEmail,
        companyName: 'Test Company CRUD',
      });

      const merchant = await merchantRepo.findByMerchantId(testMerchantId);

      expect(merchant).toBeDefined();
      expect(merchant?.merchantId).toBe(testMerchantId);
    });

    it('should find merchant by email', async () => {
      // Create merchant first
      await merchantRepo.create({
        merchantId: testMerchantId,
        cognitoUserId: testCognitoUserId,
        email: testEmail,
        companyName: 'Test Company CRUD',
      });

      const merchant = await merchantRepo.findByEmail(testEmail);

      expect(merchant).toBeDefined();
      expect(merchant?.email).toBe(testEmail);
    });

    it('should find merchant by Cognito user ID', async () => {
      // Create merchant first
      await merchantRepo.create({
        merchantId: testMerchantId,
        cognitoUserId: testCognitoUserId,
        email: testEmail,
        companyName: 'Test Company CRUD',
      });

      const merchant = await merchantRepo.findByCognitoUserId(testCognitoUserId);

      expect(merchant).toBeDefined();
      expect(merchant?.cognitoUserId).toBe(testCognitoUserId);
    });

    it('should update merchant information', async () => {
      // Create merchant first
      await merchantRepo.create({
        merchantId: testMerchantId,
        cognitoUserId: testCognitoUserId,
        email: testEmail,
        companyName: 'Test Company CRUD',
      });

      const updated = await merchantRepo.update(testMerchantId, {
        companyName: 'Updated Company Name',
        website: 'https://updated.com',
      });

      expect(updated.companyName).toBe('Updated Company Name');
      expect(updated.website).toBe('https://updated.com');
    });

    it('should update merchant status', async () => {
      // Create merchant first
      await merchantRepo.create({
        merchantId: testMerchantId,
        cognitoUserId: testCognitoUserId,
        email: testEmail,
        companyName: 'Test Company CRUD',
      });

      const updated = await merchantRepo.updateStatus(testMerchantId, 'active');

      expect(updated.status).toBe('active');
    });

    it('should update merchant plan', async () => {
      // Create merchant first
      await merchantRepo.create({
        merchantId: testMerchantId,
        cognitoUserId: testCognitoUserId,
        email: testEmail,
        companyName: 'Test Company CRUD',
      });

      const updated = await merchantRepo.updatePlan(testMerchantId, 'professional');

      expect(updated.plan).toBe('professional');
    });

    it('should mark merchant as verified', async () => {
      // Create merchant first
      await merchantRepo.create({
        merchantId: testMerchantId,
        cognitoUserId: testCognitoUserId,
        email: testEmail,
        companyName: 'Test Company CRUD',
      });

      const verified = await merchantRepo.markAsVerified(testMerchantId);

      expect(verified.status).toBe('active');
      expect(verified.verifiedAt).toBeDefined();
    });

    it('should soft delete merchant', async () => {
      // Create merchant first
      await merchantRepo.create({
        merchantId: testMerchantId,
        cognitoUserId: testCognitoUserId,
        email: testEmail,
        companyName: 'Test Company CRUD',
      });

      const deleted = await merchantRepo.softDelete(testMerchantId);

      expect(deleted.status).toBe('deleted');
      expect(deleted.deletedAt).toBeDefined();
    });

    it('should check if merchant exists', async () => {
      // Create merchant first
      await merchantRepo.create({
        merchantId: testMerchantId,
        cognitoUserId: testCognitoUserId,
        email: testEmail,
        companyName: 'Test Company CRUD',
      });

      const exists = await merchantRepo.exists(testMerchantId);
      expect(exists).toBe(true);

      const notExists = await merchantRepo.exists('non_existent_merchant');
      expect(notExists).toBe(false);
    });

    it('should delete merchant permanently', async () => {
      // Create merchant first
      await merchantRepo.create({
        merchantId: testMerchantId,
        cognitoUserId: testCognitoUserId,
        email: testEmail,
        companyName: 'Test Company CRUD',
      });

      const deleted = await merchantRepo.delete(testMerchantId);
      expect(deleted).toBe(true);

      const merchant = await merchantRepo.findByMerchantId(testMerchantId);
      expect(merchant).toBeNull();
    });
  });

  describe('ApiKeyRepository', () => {
    const testKeyId = 'key_test_crud_001';
    const testKeyHash = 'test_hash_crud_001';

    beforeEach(async () => {
      // Create merchant for API key tests
      try {
        await merchantRepo.create({
          merchantId: testMerchantId,
          cognitoUserId: testCognitoUserId,
          email: testEmail,
          companyName: 'Test Company CRUD',
        });
      } catch (error) {
        // Merchant might already exist
      }

      // Clean up test API keys
      try {
        await apiKeyRepo.delete(testKeyId);
      } catch (error) {
        // Ignore if doesn't exist
      }
    });

    it('should create a new API key', async () => {
      const newApiKey: NewApiKey = {
        keyId: testKeyId,
        merchantId: testMerchantId,
        name: 'Test API Key',
        keyPrefix: 'pk_test_',
        keyHash: testKeyHash,
        environment: 'development',
        permissions: ['chat:read', 'documents:write'],
        status: 'active',
      };

      const apiKey = await apiKeyRepo.create(newApiKey);

      expect(apiKey).toBeDefined();
      expect(apiKey.keyId).toBe(testKeyId);
      expect(apiKey.merchantId).toBe(testMerchantId);
      expect(apiKey.name).toBe('Test API Key');
      expect(apiKey.environment).toBe('development');
      expect(apiKey.status).toBe('active');
    });

    it('should find API key by keyId', async () => {
      // Create API key first
      await apiKeyRepo.create({
        keyId: testKeyId,
        merchantId: testMerchantId,
        name: 'Test API Key',
        keyPrefix: 'pk_test_',
        keyHash: testKeyHash,
        environment: 'development',
      });

      const apiKey = await apiKeyRepo.findByKeyId(testKeyId);

      expect(apiKey).toBeDefined();
      expect(apiKey?.keyId).toBe(testKeyId);
    });

    it('should find API keys by merchant ID', async () => {
      // Create API key first
      await apiKeyRepo.create({
        keyId: testKeyId,
        merchantId: testMerchantId,
        name: 'Test API Key',
        keyPrefix: 'pk_test_',
        keyHash: testKeyHash,
        environment: 'development',
      });

      const apiKeys = await apiKeyRepo.findByMerchantId(testMerchantId);

      expect(apiKeys).toBeDefined();
      expect(apiKeys.length).toBeGreaterThan(0);
      expect(apiKeys[0].merchantId).toBe(testMerchantId);
    });

    it('should find API keys by prefix', async () => {
      // Create API key first
      await apiKeyRepo.create({
        keyId: testKeyId,
        merchantId: testMerchantId,
        name: 'Test API Key',
        keyPrefix: 'pk_test_',
        keyHash: testKeyHash,
        environment: 'development',
      });

      const apiKeys = await apiKeyRepo.findByPrefix('pk_test_');

      expect(apiKeys).toBeDefined();
      expect(apiKeys.length).toBeGreaterThan(0);
    });

    it('should update API key last used timestamp', async () => {
      // Create API key first
      await apiKeyRepo.create({
        keyId: testKeyId,
        merchantId: testMerchantId,
        name: 'Test API Key',
        keyPrefix: 'pk_test_',
        keyHash: testKeyHash,
        environment: 'development',
      });

      await apiKeyRepo.updateLastUsed(testKeyId);

      const apiKey = await apiKeyRepo.findByKeyId(testKeyId);
      expect(apiKey?.lastUsedAt).toBeDefined();
    });

    it('should revoke API key', async () => {
      // Create API key first
      await apiKeyRepo.create({
        keyId: testKeyId,
        merchantId: testMerchantId,
        name: 'Test API Key',
        keyPrefix: 'pk_test_',
        keyHash: testKeyHash,
        environment: 'development',
      });

      const revoked = await apiKeyRepo.revoke(testKeyId);

      expect(revoked.status).toBe('revoked');
    });

    it('should mark API key as expired', async () => {
      // Create API key first
      await apiKeyRepo.create({
        keyId: testKeyId,
        merchantId: testMerchantId,
        name: 'Test API Key',
        keyPrefix: 'pk_test_',
        keyHash: testKeyHash,
        environment: 'development',
      });

      const expired = await apiKeyRepo.markAsExpired(testKeyId);

      expect(expired.status).toBe('expired');
    });

    it('should count API keys by merchant ID', async () => {
      // Create API key first
      await apiKeyRepo.create({
        keyId: testKeyId,
        merchantId: testMerchantId,
        name: 'Test API Key',
        keyPrefix: 'pk_test_',
        keyHash: testKeyHash,
        environment: 'development',
      });

      const count = await apiKeyRepo.countByMerchantId(testMerchantId);

      expect(count).toBeGreaterThan(0);
    });

    it('should delete API key', async () => {
      // Create API key first
      await apiKeyRepo.create({
        keyId: testKeyId,
        merchantId: testMerchantId,
        name: 'Test API Key',
        keyPrefix: 'pk_test_',
        keyHash: testKeyHash,
        environment: 'development',
      });

      const deleted = await apiKeyRepo.delete(testKeyId);
      expect(deleted).toBe(true);

      const apiKey = await apiKeyRepo.findByKeyId(testKeyId);
      expect(apiKey).toBeNull();
    });
  });

  describe('MerchantSettingsRepository', () => {
    beforeEach(async () => {
      // Create merchant for settings tests
      try {
        await merchantRepo.create({
          merchantId: testMerchantId,
          cognitoUserId: testCognitoUserId,
          email: testEmail,
          companyName: 'Test Company CRUD',
        });
      } catch (error) {
        // Merchant might already exist
      }

      // Clean up test settings
      try {
        await settingsRepo.delete(testMerchantId);
      } catch (error) {
        // Ignore if doesn't exist
      }
    });

    it('should create merchant settings', async () => {
      const newSettings: NewMerchantSettings = {
        merchantId: testMerchantId,
        settings: {
          widget: {
            theme: {
              primaryColor: '#007bff',
              position: 'bottom-right',
            },
          },
        },
      };

      const settings = await settingsRepo.create(newSettings);

      expect(settings).toBeDefined();
      expect(settings.merchantId).toBe(testMerchantId);
      expect(settings.settings).toBeDefined();
    });

    it('should find settings by merchant ID', async () => {
      // Create settings first
      await settingsRepo.create({
        merchantId: testMerchantId,
        settings: {
          widget: { theme: { primaryColor: '#007bff' } },
        },
      });

      const settings = await settingsRepo.findByMerchantId(testMerchantId);

      expect(settings).toBeDefined();
      expect(settings?.merchantId).toBe(testMerchantId);
    });

    it('should update merchant settings', async () => {
      // Create settings first
      await settingsRepo.create({
        merchantId: testMerchantId,
        settings: {
          widget: { theme: { primaryColor: '#007bff' } },
        },
      });

      const updatedSettings = {
        widget: {
          theme: {
            primaryColor: '#ff0000',
            position: 'bottom-left',
          },
        },
      };

      const updated = await settingsRepo.update(testMerchantId, updatedSettings);

      expect(updated.settings).toEqual(updatedSettings);
    });

    it('should upsert merchant settings (create if not exists)', async () => {
      const newSettings = {
        widget: { theme: { primaryColor: '#00ff00' } },
      };

      const settings = await settingsRepo.upsert(testMerchantId, newSettings);

      expect(settings).toBeDefined();
      expect(settings.merchantId).toBe(testMerchantId);
      expect(settings.settings).toEqual(newSettings);
    });

    it('should upsert merchant settings (update if exists)', async () => {
      // Create settings first
      await settingsRepo.create({
        merchantId: testMerchantId,
        settings: {
          widget: { theme: { primaryColor: '#007bff' } },
        },
      });

      const updatedSettings = {
        widget: { theme: { primaryColor: '#ff00ff' } },
      };

      const settings = await settingsRepo.upsert(testMerchantId, updatedSettings);

      expect(settings.settings).toEqual(updatedSettings);
    });

    it('should delete merchant settings', async () => {
      // Create settings first
      await settingsRepo.create({
        merchantId: testMerchantId,
        settings: {
          widget: { theme: { primaryColor: '#007bff' } },
        },
      });

      const deleted = await settingsRepo.delete(testMerchantId);
      expect(deleted).toBe(true);

      const settings = await settingsRepo.findByMerchantId(testMerchantId);
      expect(settings).toBeNull();
    });
  });
});
