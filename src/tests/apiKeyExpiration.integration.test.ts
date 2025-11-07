/**
 * API Key Expiration Integration Test
 * Tests the complete flow of API key validation with expiration checking
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getApiKeyService } from '../services/ApiKeyService';
import { getApiKeyRepository } from '../repositories/ApiKeyRepository';
import { getMerchantRepository } from '../repositories/MerchantRepository';

describe('API Key Expiration Integration', () => {
  const apiKeyService = getApiKeyService();
  const apiKeyRepository = getApiKeyRepository();
  const merchantRepository = getMerchantRepository();
  
  const testMerchantId = 'test_merchant_expiration';
  let testKeyId: string;
  let testKey: string;

  beforeAll(async () => {
    // Create a test merchant first
    try {
      await merchantRepository.create({
        merchantId: testMerchantId,
        cognitoUserId: 'test_cognito_user_expiration',
        email: 'test-expiration@example.com',
        companyName: 'Test Expiration Company',
        status: 'active',
        plan: 'starter',
      });
    } catch (error) {
      // Merchant might already exist, ignore error
    }

    // Create a test API key that expires in 1 second
    const result = await apiKeyService.generateKey({
      merchantId: testMerchantId,
      name: 'Test Expiration Key',
      environment: 'development',
      permissions: ['chat:read'],
      expiresInDays: 0.00001, // Expires almost immediately (< 1 second)
    });

    testKeyId = result.keyId;
    testKey = result.key;
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await apiKeyRepository.revoke(testKeyId);
      // Note: We don't delete the merchant as it might be used by other tests
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should validate a non-expired key successfully', async () => {
    // Validate immediately (before expiration)
    const validation = await apiKeyService.validateKey(testKey);

    expect(validation.valid).toBe(true);
    expect(validation.merchantId).toBe(testMerchantId);
    expect(validation.keyId).toBe(testKeyId);
    expect(validation.permissions).toEqual(['chat:read']);
  });

  it('should reject an expired key', async () => {
    // Wait for the key to expire (2 seconds to be safe)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to validate the expired key
    const validation = await apiKeyService.validateKey(testKey);

    expect(validation.valid).toBe(false);
    expect(validation.merchantId).toBeUndefined();
    expect(validation.keyId).toBeUndefined();
  });

  it('should mark expired key as expired in database', async () => {
    // Check the key status in the database
    const apiKey = await apiKeyRepository.findByKeyId(testKeyId);

    expect(apiKey).toBeDefined();
    expect(apiKey!.status).toBe('expired');
  });

  it('should handle keys with no expiration', async () => {
    // Create a key with no expiration
    const result = await apiKeyService.generateKey({
      merchantId: testMerchantId,
      name: 'No Expiration Key',
      environment: 'development',
      permissions: ['chat:read'],
      // No expiresInDays specified
    });

    // Validate the key
    const validation = await apiKeyService.validateKey(result.key);

    expect(validation.valid).toBe(true);
    expect(validation.merchantId).toBe(testMerchantId);

    // Clean up
    await apiKeyRepository.revoke(result.keyId);
  });

  it('should process expired keys in batch', async () => {
    // Create multiple keys that expire immediately
    const keys = await Promise.all([
      apiKeyService.generateKey({
        merchantId: testMerchantId,
        name: 'Batch Test Key 1',
        environment: 'development',
        permissions: ['chat:read'],
        expiresInDays: 0.00001,
      }),
      apiKeyService.generateKey({
        merchantId: testMerchantId,
        name: 'Batch Test Key 2',
        environment: 'development',
        permissions: ['chat:read'],
        expiresInDays: 0.00001,
      }),
    ]);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Process expired keys
    const count = await apiKeyService.processExpiredKeys();

    expect(count).toBeGreaterThanOrEqual(2);

    // Clean up
    for (const key of keys) {
      await apiKeyRepository.revoke(key.keyId);
    }
  });
});
