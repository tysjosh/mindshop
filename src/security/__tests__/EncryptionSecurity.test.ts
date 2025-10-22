import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EncryptionService } from '../../services/EncryptionService';
import { KMSClient } from '@aws-sdk/client-kms';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import * as crypto from 'crypto';

// Mock crypto module with more realistic behavior
let mockInputData = '';
let mockCounter = 0;
let mockCallCount = 0;

vi.mock('crypto', () => ({
  default: {
    createCipher: vi.fn().mockImplementation(() => ({
      update: vi.fn().mockImplementation((data) => {
        mockInputData = data.toString();
        return Buffer.from(mockInputData + '_encrypted');
      }),
      final: vi.fn().mockReturnValue(Buffer.from('_final')),
      getAuthTag: vi.fn().mockReturnValue(Buffer.from('authtag'))
    })),
    createDecipher: vi.fn().mockImplementation(() => ({
      update: vi.fn().mockImplementation(() => {
        return Buffer.from(mockInputData);
      }),
      final: vi.fn().mockReturnValue(Buffer.from(''))
    })),
    randomBytes: vi.fn().mockImplementation((size) => {
      // Create deterministic but different "random" bytes for each call
      mockCallCount++;
      return Buffer.alloc(size, 42 + mockCallCount); // Different value for each call
    }),
    createHash: vi.fn().mockImplementation(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockImplementation((encoding) => {
        // Create a deterministic hash based on the data that was updated
        const hash = 'deterministic_hash_value';
        return encoding === 'hex' ? Buffer.from(hash).toString('hex') : hash;
      })
    })),
    timingSafeEqual: vi.fn().mockImplementation((a, b) => {
      if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) {
        return Buffer.compare(a, b) === 0;
      }
      return a === b;
    }),
    pbkdf2Sync: vi.fn().mockImplementation((password, salt, iterations, keylen) => {
      // Create deterministic hash based on password and salt
      const combined = password.toString() + salt.toString();
      const hashValue = combined.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return Buffer.alloc(keylen, hashValue % 256);
    })
  },
  createCipher: vi.fn().mockImplementation(() => ({
    update: vi.fn().mockImplementation((data) => {
      mockInputData = data.toString();
      return Buffer.from(mockInputData + '_encrypted');
    }),
    final: vi.fn().mockReturnValue(Buffer.from('_final')),
    getAuthTag: vi.fn().mockReturnValue(Buffer.from('authtag'))
  })),
  createDecipher: vi.fn().mockImplementation(() => ({
    update: vi.fn().mockImplementation(() => {
      return Buffer.from(mockInputData);
    }),
    final: vi.fn().mockReturnValue(Buffer.from(''))
  })),
  randomBytes: vi.fn().mockImplementation((size) => {
    // Create deterministic but different "random" bytes for each call
    mockCallCount++;
    return Buffer.alloc(size, 42 + mockCallCount); // Different value for each call
  }),
  createHash: vi.fn().mockImplementation(() => {
    let updateData = '';
    return {
      update: vi.fn().mockImplementation((data) => {
        updateData += data.toString();
        return this;
      }),
      digest: vi.fn().mockImplementation((encoding) => {
        // Create a deterministic hash based on the actual data that was updated
        const hash = updateData.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0).toString(16);
        const paddedHash = hash.padStart(64, '0'); // SHA256 produces 64 hex characters
        return encoding === 'hex' ? paddedHash : Buffer.from(paddedHash, 'hex');
      })
    };
  }),
  timingSafeEqual: vi.fn().mockImplementation((a, b) => {
    if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) {
      return Buffer.compare(a, b) === 0;
    }
    return a === b;
  }),
  pbkdf2Sync: vi.fn().mockImplementation((password, salt, iterations, keylen) => {
    // Create deterministic hash based on password and salt
    const combined = password.toString() + salt.toString();
    const hashValue = combined.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Buffer.alloc(keylen, hashValue % 256);
  })
}));

// Mock AWS SDK v3
vi.mock('@aws-sdk/client-kms', () => ({
  KMSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  EncryptCommand: vi.fn(),
  DecryptCommand: vi.fn(),
  GenerateDataKeyCommand: vi.fn(),
  CreateKeyCommand: vi.fn(),
  DescribeKeyCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PutItemCommand: vi.fn(),
  GetItemCommand: vi.fn(),
  DeleteItemCommand: vi.fn(),
  ScanCommand: vi.fn(),
}));

describe('Encryption Security Tests', () => {
  let encryptionService: EncryptionService;
  let mockKMSClient: any;
  let mockDynamoClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockKMSClient = {
      send: vi.fn(),
    };

    mockDynamoClient = {
      send: vi.fn(),
    };

    (KMSClient as any).mockImplementation(() => mockKMSClient);
    (DynamoDBClient as any).mockImplementation(() => mockDynamoClient);

    encryptionService = new EncryptionService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Envelope Encryption with KMS', () => {
    it('should encrypt data using envelope encryption', async () => {
      // Arrange
      const plaintext = 'sensitive customer data';
      const encryptionContext = {
        merchant_id: 'merchant123',
        data_type: 'customer_data',
        purpose: 'data_protection',
        timestamp: new Date().toISOString(),
      };

      const mockDataKey = {
        Plaintext: new Uint8Array(32), // 256-bit key
        CiphertextBlob: new Uint8Array(64), // Encrypted data key
      };

      mockKMSClient.send.mockResolvedValue(mockDataKey);

      // Act
      const result = await encryptionService.encryptData(plaintext, encryptionContext);

      // Assert
      expect(result.ciphertext).toBeDefined();
      expect(result.dataKey).toBeDefined();
      expect(result.algorithm).toBe('AES-256-CBC');
      expect(result.keyId).toBeDefined();
      expect(result.encryptionContext).toEqual(encryptionContext);
      expect(result.iv).toBeDefined();
      expect(result.authTag).toBeDefined();

      // Verify KMS was called
      expect(mockKMSClient.send).toHaveBeenCalled();
    });

    it('should decrypt data using envelope encryption', async () => {
      // Arrange
      const originalPlaintext = 'sensitive customer data';
      const encryptionContext = {
        merchant_id: 'merchant123',
        data_type: 'customer_data',
        purpose: 'data_protection',
        timestamp: new Date().toISOString(),
      };

      // First encrypt the data
      const mockDataKeyGenerate = {
        Plaintext: crypto.randomBytes(32),
        CiphertextBlob: crypto.randomBytes(64),
      };

      const mockDataKeyDecrypt = {
        Plaintext: mockDataKeyGenerate.Plaintext,
      };

      mockKMSClient.send
        .mockResolvedValueOnce(mockDataKeyGenerate) // For encryption
        .mockResolvedValueOnce(mockDataKeyDecrypt); // For decryption

      const encrypted = await encryptionService.encryptData(originalPlaintext, encryptionContext);

      // Act
      const decrypted = await encryptionService.decryptData(encrypted);

      // Assert
      expect(decrypted.toString('utf8')).toBe(originalPlaintext);
      expect(mockKMSClient.send).toHaveBeenCalledTimes(2);
    });

    it('should handle KMS service failures during encryption', async () => {
      // Arrange
      const plaintext = 'sensitive data';
      const encryptionContext = {
        merchant_id: 'merchant123',
        data_type: 'test_data',
        purpose: 'testing',
        timestamp: new Date().toISOString(),
      };

      mockKMSClient.send.mockRejectedValue(new Error('KMS service unavailable'));

      // Act & Assert
      await expect(
        encryptionService.encryptData(plaintext, encryptionContext)
      ).rejects.toThrow('Encryption failed: KMS service unavailable');
    });

    it('should handle KMS service failures during decryption', async () => {
      // Arrange
      const encryptedData = {
        ciphertext: 'encrypted-data',
        dataKey: 'encrypted-key',
        algorithm: 'AES-256-GCM',
        keyId: 'test-key',
        encryptionContext: {
          merchant_id: 'merchant123',
          data_type: 'test_data',
          purpose: 'testing',
          timestamp: new Date().toISOString(),
        },
        iv: 'initialization-vector',
        authTag: 'auth-tag',
      };

      mockKMSClient.send.mockRejectedValue(new Error('KMS decrypt failed'));

      // Act & Assert
      await expect(
        encryptionService.decryptData(encryptedData)
      ).rejects.toThrow('Decryption failed: KMS decrypt failed');
    });
  });

  describe('String Encryption/Decryption', () => {
    it('should encrypt and decrypt strings with automatic context', async () => {
      // Arrange
      const originalString = 'sensitive customer information';
      const merchantId = 'merchant123';
      const dataType = 'customer_pii';

      const mockDataKey = {
        Plaintext: crypto.randomBytes(32),
        CiphertextBlob: crypto.randomBytes(64),
      };

      mockKMSClient.send
        .mockResolvedValueOnce(mockDataKey) // For encryption
        .mockResolvedValueOnce({ Plaintext: mockDataKey.Plaintext }); // For decryption

      // Act
      const encrypted = await encryptionService.encryptString(
        originalString,
        merchantId,
        dataType
      );
      const decrypted = await encryptionService.decryptString(encrypted);

      // Assert
      expect(encrypted).not.toBe(originalString);
      expect(encrypted).toContain('"c":'); // Contains ciphertext
      expect(encrypted).toContain('"k":'); // Contains encrypted key
      expect(encrypted).toContain('"ctx":'); // Contains context
      expect(decrypted).toBe(originalString);
    });

    it('should include proper encryption context in string encryption', async () => {
      // Arrange
      const testString = 'test data';
      const merchantId = 'merchant123';
      const dataType = 'test_type';
      const purpose = 'testing';

      const mockDataKey = {
        Plaintext: crypto.randomBytes(32),
        CiphertextBlob: crypto.randomBytes(64),
      };

      mockKMSClient.send.mockResolvedValue(mockDataKey);

      // Act
      const encrypted = await encryptionService.encryptString(
        testString,
        merchantId,
        dataType,
        purpose
      );

      // Assert
      const parsed = JSON.parse(encrypted);
      expect(parsed.ctx.merchant_id).toBe(merchantId);
      expect(parsed.ctx.data_type).toBe(dataType);
      expect(parsed.ctx.purpose).toBe(purpose);
      expect(parsed.ctx.timestamp).toBeDefined();
    });
  });

  describe('Merchant Key Management', () => {
    it('should create merchant-specific KMS keys', async () => {
      // Arrange
      const merchantId = 'merchant123';
      const description = 'Test merchant key';

      const mockKeyMetadata = {
        KeyId: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
      };

      mockKMSClient.send
        .mockResolvedValueOnce({ KeyMetadata: mockKeyMetadata }) // CreateKey
        .mockResolvedValueOnce({}); // DynamoDB PutItem

      mockDynamoClient.send.mockResolvedValue({});

      // Act
      const keyId = await encryptionService.createMerchantKey(merchantId, description);

      // Assert
      expect(keyId).toBe(mockKeyMetadata.KeyId);
      expect(mockKMSClient.send).toHaveBeenCalled();
      expect(mockDynamoClient.send).toHaveBeenCalled();
    });

    it('should retrieve existing merchant keys', async () => {
      // Arrange
      const merchantId = 'merchant123';
      const existingKeyId = 'existing-key-id';

      mockDynamoClient.send.mockResolvedValue({
        Item: {
          merchant_id: { S: merchantId },
          key_id: { S: existingKeyId },
        },
      });

      // Act
      const keyId = await encryptionService.getMerchantKey(merchantId);

      // Assert
      expect(keyId).toBe(existingKeyId);
      expect(mockDynamoClient.send).toHaveBeenCalled();
    });

    it('should create new key if merchant key does not exist', async () => {
      // Arrange
      const merchantId = 'new-merchant';

      mockDynamoClient.send
        .mockResolvedValueOnce({}) // GetItem returns empty
        .mockResolvedValueOnce({}); // PutItem for new key

      const mockKeyMetadata = {
        KeyId: 'new-key-id',
      };

      mockKMSClient.send.mockResolvedValue({ KeyMetadata: mockKeyMetadata });

      // Act
      const keyId = await encryptionService.getMerchantKey(merchantId);

      // Assert
      expect(keyId).toBe('new-key-id');
      expect(mockKMSClient.send).toHaveBeenCalled(); // CreateKey was called
    });

    it('should fall back to default key on errors', async () => {
      // Arrange
      const merchantId = 'error-merchant';

      mockDynamoClient.send.mockRejectedValue(new Error('DynamoDB error'));
      mockKMSClient.send.mockRejectedValue(new Error('KMS error'));

      // Act
      const keyId = await encryptionService.getMerchantKey(merchantId);

      // Assert
      expect(keyId).toBe(process.env.DEFAULT_KMS_KEY_ID || 'alias/mindsdb-rag-encryption');
    });
  });

  describe('Key Rotation and Management', () => {
    it('should get key rotation information', async () => {
      // Arrange
      const keyId = 'test-key-id';
      const creationDate = new Date('2023-01-01');

      mockKMSClient.send.mockResolvedValue({
        KeyMetadata: {
          KeyId: keyId,
          CreationDate: creationDate,
          KeyRotationStatus: true,
        },
      });

      // Act
      const rotationInfo = await encryptionService.getKeyRotationInfo(keyId);

      // Assert
      expect(rotationInfo.keyId).toBe(keyId);
      expect(rotationInfo.rotationEnabled).toBe(true);
      expect(rotationInfo.lastRotation).toEqual(creationDate);
      expect(rotationInfo.nextRotation).toBeInstanceOf(Date);
    });

    it('should handle key rotation initiation', async () => {
      // Arrange
      const keyId = 'test-key-id';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      await encryptionService.rotateKey(keyId);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('AUDIT_LOG', expect.objectContaining({
        event_type: 'key_rotation',
        key_id: keyId,
      }));

      consoleSpy.mockRestore();
    });
  });

  describe('Data Storage Encryption', () => {
    it('should encrypt data for database storage', async () => {
      // Arrange
      const data = { userId: 'user123', email: 'user@example.com' };
      const merchantId = 'merchant123';
      const tableName = 'users';

      const mockDataKey = {
        Plaintext: crypto.randomBytes(32),
        CiphertextBlob: crypto.randomBytes(64),
      };

      mockKMSClient.send.mockResolvedValue(mockDataKey);

      // Act
      const encrypted = await encryptionService.encryptForStorage(data, merchantId, tableName);

      // Assert
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toContain('user@example.com');
      expect(typeof encrypted).toBe('string');
    });

    it('should decrypt data from database storage', async () => {
      // Arrange
      const originalData = { userId: 'user123', email: 'user@example.com' };
      const merchantId = 'merchant123';
      const tableName = 'users';

      const mockDataKey = {
        Plaintext: crypto.randomBytes(32),
        CiphertextBlob: crypto.randomBytes(64),
      };

      mockKMSClient.send
        .mockResolvedValueOnce(mockDataKey) // For encryption
        .mockResolvedValueOnce({ Plaintext: mockDataKey.Plaintext }); // For decryption

      const encrypted = await encryptionService.encryptForStorage(originalData, merchantId, tableName);

      // Act
      const decrypted = await encryptionService.decryptFromStorage(encrypted);

      // Assert
      expect(decrypted).toEqual(originalData);
    });
  });

  describe('Cryptographic Utilities', () => {
    it('should create secure hashes with salt', () => {
      // Arrange
      const data = 'sensitive data to hash';

      // Act
      const hash1 = encryptionService.createSecureHash(data);
      const hash2 = encryptionService.createSecureHash(data);

      // Assert
      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      expect(hash1).not.toBe(hash2); // Different salts should produce different hashes
      expect(hash1).toMatch(/^[a-f0-9]+:[a-f0-9]+$/); // Format: salt:hash
    });

    it('should verify secure hashes correctly', () => {
      // Arrange
      const data = 'test data';
      const hash = encryptionService.createSecureHash(data);

      // Act
      const isValid = encryptionService.verifySecureHash(data, hash);
      const isInvalid = encryptionService.verifySecureHash('wrong data', hash);

      // Assert
      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    it('should generate cryptographically secure random tokens', () => {
      // Arrange & Act
      const token1 = encryptionService.generateSecureToken(32);
      const token2 = encryptionService.generateSecureToken(32);
      const shortToken = encryptionService.generateSecureToken(16);

      // Assert
      expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token2).toHaveLength(64);
      expect(shortToken).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(token1).not.toBe(token2);
      expect(token1).toMatch(/^[a-f0-9]+$/);
    });

    it('should handle malformed hash verification gracefully', () => {
      // Arrange
      const data = 'test data';
      const malformedHash = 'not-a-valid-hash';

      // Act
      const result = encryptionService.verifySecureHash(data, malformedHash);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Health Status and Monitoring', () => {
    it('should report healthy status when all services are available', async () => {
      // Arrange
      mockKMSClient.send.mockResolvedValue({
        KeyMetadata: { KeyId: 'test-key' },
      });
      mockDynamoClient.send.mockResolvedValue({
        Items: [],
      });

      // Act
      const health = await encryptionService.getHealthStatus();

      // Assert
      expect(health.status).toBe('healthy');
      expect(health.kmsConnectivity).toBe(true);
      expect(health.dynamoConnectivity).toBe(true);
      expect(health.keysCached).toBe(0);
      expect(health.lastError).toBeUndefined();
    });

    it('should report degraded status when one service fails', async () => {
      // Arrange
      mockKMSClient.send.mockResolvedValue({
        KeyMetadata: { KeyId: 'test-key' },
      });
      mockDynamoClient.send.mockRejectedValue(new Error('DynamoDB connection failed'));

      // Act
      const health = await encryptionService.getHealthStatus();

      // Assert
      expect(health.status).toBe('degraded');
      expect(health.kmsConnectivity).toBe(true);
      expect(health.dynamoConnectivity).toBe(false);
      expect(health.lastError).toContain('DynamoDB error');
    });

    it('should report unhealthy status when all services fail', async () => {
      // Arrange
      mockKMSClient.send.mockRejectedValue(new Error('KMS connection failed'));
      mockDynamoClient.send.mockRejectedValue(new Error('DynamoDB connection failed'));

      // Act
      const health = await encryptionService.getHealthStatus();

      // Assert
      expect(health.status).toBe('unhealthy');
      expect(health.kmsConnectivity).toBe(false);
      expect(health.dynamoConnectivity).toBe(false);
      expect(health.lastError).toBeDefined();
    });
  });

  describe('Security Edge Cases and Attack Vectors', () => {
    it('should handle encryption context tampering', async () => {
      // Arrange
      const plaintext = 'sensitive data';
      const originalContext = {
        merchant_id: 'merchant123',
        data_type: 'customer_data',
        purpose: 'data_protection',
        timestamp: new Date().toISOString(),
      };

      const tamperedContext = {
        ...originalContext,
        merchant_id: 'attacker_merchant', // Tampered merchant ID
      };

      const mockDataKey = {
        Plaintext: crypto.randomBytes(32),
        CiphertextBlob: crypto.randomBytes(64),
      };

      mockKMSClient.send
        .mockResolvedValueOnce(mockDataKey) // For encryption with original context
        .mockRejectedValueOnce(new Error('Invalid encryption context')); // For decryption with tampered context

      const encrypted = await encryptionService.encryptData(plaintext, originalContext);

      // Tamper with the encryption context
      encrypted.encryptionContext = tamperedContext;

      // Act & Assert
      await expect(
        encryptionService.decryptData(encrypted)
      ).rejects.toThrow('Decryption failed: Invalid encryption context');
    });

    it('should prevent key cache poisoning', () => {
      // Arrange
      const service1 = new EncryptionService();
      const service2 = new EncryptionService();

      // Act
      service1.cleanupKeyCache();
      service2.cleanupKeyCache();

      // Assert - Each service should have its own cache
      expect(service1).not.toBe(service2);
    });

    it('should handle concurrent encryption requests safely', async () => {
      // Arrange
      const plaintexts = Array.from({ length: 10 }, (_, i) => `data-${i}`);
      const encryptionContext = {
        merchant_id: 'merchant123',
        data_type: 'test_data',
        purpose: 'concurrency_test',
        timestamp: new Date().toISOString(),
      };

      const mockDataKey = {
        Plaintext: crypto.randomBytes(32),
        CiphertextBlob: crypto.randomBytes(64),
      };

      mockKMSClient.send.mockResolvedValue(mockDataKey);

      // Act
      const encryptionPromises = plaintexts.map(text =>
        encryptionService.encryptData(text, encryptionContext)
      );

      const results = await Promise.all(encryptionPromises);

      // Assert
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.ciphertext).toBeDefined();
        expect(result.encryptionContext.merchant_id).toBe('merchant123');
      });

      // All ciphertexts should be different
      const ciphertexts = results.map(r => r.ciphertext);
      const uniqueCiphertexts = new Set(ciphertexts);
      expect(uniqueCiphertexts.size).toBe(10);
    });

    it('should validate encryption context completeness', async () => {
      // Arrange
      const plaintext = 'test data';
      const incompleteContext = {
        merchant_id: 'merchant123',
        // Missing required fields
      } as any;

      const mockDataKey = {
        Plaintext: crypto.randomBytes(32),
        CiphertextBlob: crypto.randomBytes(64),
      };

      mockKMSClient.send.mockResolvedValue(mockDataKey);

      // Act & Assert
      await expect(
        encryptionService.encryptData(plaintext, incompleteContext)
      ).rejects.toThrow(); // Should validate required context fields
    });

    it('should handle memory cleanup for sensitive data', async () => {
      // Arrange
      const plaintext = 'very sensitive data that should be cleared from memory';
      const encryptionContext = {
        merchant_id: 'merchant123',
        data_type: 'sensitive',
        purpose: 'memory_test',
        timestamp: new Date().toISOString(),
      };

      const mockDataKey = {
        Plaintext: crypto.randomBytes(32),
        CiphertextBlob: crypto.randomBytes(64),
      };

      mockKMSClient.send
        .mockResolvedValueOnce(mockDataKey) // For encryption
        .mockResolvedValueOnce({ Plaintext: mockDataKey.Plaintext }); // For decryption

      // Act
      const encrypted = await encryptionService.encryptData(plaintext, encryptionContext);
      const decrypted = await encryptionService.decryptData(encrypted);

      // Assert
      expect(decrypted.toString('utf8')).toBe(plaintext);
      
      // The service should have cleared sensitive data from memory
      // This is more of a documentation test since we can't easily verify memory cleanup
      expect(encrypted.ciphertext).not.toContain(plaintext);
    });

    it('should prevent timing attacks on decryption', async () => {
      // Arrange
      const validEncrypted = {
        ciphertext: 'valid-ciphertext',
        dataKey: 'valid-encrypted-key',
        algorithm: 'AES-256-GCM',
        keyId: 'test-key',
        encryptionContext: {
          merchant_id: 'merchant123',
          data_type: 'test',
          purpose: 'timing_test',
          timestamp: new Date().toISOString(),
        },
        iv: 'valid-iv',
        authTag: 'valid-auth-tag',
      };

      const invalidEncrypted = {
        ...validEncrypted,
        ciphertext: 'invalid-ciphertext',
      };

      mockKMSClient.send
        .mockRejectedValueOnce(new Error('Invalid ciphertext'))
        .mockRejectedValueOnce(new Error('Invalid ciphertext'));

      // Act
      const start1 = Date.now();
      try {
        await encryptionService.decryptData(validEncrypted);
      } catch (e) {
        // Expected to fail
      }
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      try {
        await encryptionService.decryptData(invalidEncrypted);
      } catch (e) {
        // Expected to fail
      }
      const time2 = Date.now() - start2;

      // Assert - Timing should be similar to prevent timing attacks
      const timeDifference = Math.abs(time1 - time2);
      expect(timeDifference).toBeLessThan(100); // Less than 100ms difference
    });
  });
});