import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PIIRedactorService } from '../../services/PIIRedactor';
import { EncryptionService } from '../../services/EncryptionService';
import { KMS, DynamoDB } from 'aws-sdk';

// Mock AWS services
vi.mock('aws-sdk', () => ({
  KMS: vi.fn().mockImplementation(() => ({
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  })),
  DynamoDB: vi.fn().mockImplementation(() => ({
    putItem: vi.fn(),
    getItem: vi.fn(),
    deleteItem: vi.fn(),
  })),
}));

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

describe('PII Redaction Security Tests', () => {
  let piiRedactor: PIIRedactorService;
  let encryptionService: EncryptionService;
  let mockKMS: any;
  let mockDynamoDB: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup AWS service mocks with proper promise-based responses
    mockKMS = {
      encrypt: vi.fn().mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          CiphertextBlob: Buffer.from('encrypted-data', 'base64'),
        }),
      }),
      decrypt: vi.fn().mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          Plaintext: Buffer.from('decrypted-data', 'utf8'),
        }),
      }),
    };

    mockDynamoDB = {
      putItem: vi.fn().mockReturnValue({
        promise: vi.fn().mockResolvedValue({}),
      }),
      getItem: vi.fn().mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          Item: {
            token_id: { S: 'test-token' },
            encrypted_value: { S: 'encrypted-value' },
            data_type: { S: 'personal' },
            merchant_id: { S: 'merchant123' },
            created_at: { S: new Date().toISOString() },
          },
        }),
      }),
      deleteItem: vi.fn().mockReturnValue({
        promise: vi.fn().mockResolvedValue({}),
      }),
    };

    // Mock AWS SDK constructors
    (KMS as any).mockImplementation(() => mockKMS);
    (DynamoDB as any).mockImplementation(() => mockDynamoDB);

    // Create service instances after mocks are set up
    piiRedactor = new PIIRedactorService();
    encryptionService = new EncryptionService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('PII Pattern Detection and Redaction', () => {
    it('should detect and redact email addresses', () => {
      // Arrange
      const text = 'Contact us at john.doe@example.com or support@company.org for help';

      // Act
      const result = piiRedactor.redactQuery(text);

      // Assert
      expect(result.sanitizedText).not.toContain('john.doe@example.com');
      expect(result.sanitizedText).not.toContain('support@company.org');
      expect(result.sanitizedText).toMatch(/\[PII_TOKEN_\d+_[a-f0-9]{8}\]/);
      expect(result.tokens.size).toBe(2);
    });

    it('should detect and redact phone numbers', () => {
      // Arrange
      const text = 'Call us at 555-123-4567 or (555) 987-6543 for assistance';

      // Act
      const result = piiRedactor.redactQuery(text);

      // Assert
      expect(result.sanitizedText).not.toContain('555-123-4567');
      expect(result.sanitizedText).not.toContain('(555) 987-6543');
      expect(result.tokens.size).toBe(2);
    });

    it('should detect and redact credit card numbers', () => {
      // Arrange
      const text = 'My card number is 4532-1234-5678-9012 and expires 12/25';

      // Act
      const result = piiRedactor.redactQuery(text);

      // Assert
      expect(result.sanitizedText).not.toContain('4532-1234-5678-9012');
      expect(result.tokens.size).toBe(1);
    });

    it('should detect and redact SSN patterns', () => {
      // Arrange
      const text = 'My SSN is 123-45-6789 for verification';

      // Act
      const result = piiRedactor.redactQuery(text);

      // Assert
      expect(result.sanitizedText).not.toContain('123-45-6789');
      expect(result.tokens.size).toBe(1);
    });

    it('should detect and redact address patterns', () => {
      // Arrange
      const text = 'I live at 123 Main Street, Apartment 4B';

      // Act
      const result = piiRedactor.redactQuery(text);

      // Assert
      expect(result.sanitizedText).not.toContain('123 Main Street');
      expect(result.tokens.size).toBe(1);
    });

    it('should detect and redact payment tokens', () => {
      // Arrange
      const text = 'Payment token: tok_1234567890abcdef and card token: card_abcdef1234567890';

      // Act
      const result = piiRedactor.redactQuery(text);

      // Assert
      expect(result.sanitizedText).not.toContain('tok_1234567890abcdef');
      expect(result.sanitizedText).not.toContain('card_abcdef1234567890');
      expect(result.tokens.size).toBe(2);
    });

    it('should handle multiple PII types in single text', () => {
      // Arrange
      const text = 'Contact John Doe at john@example.com or 555-123-4567. Card: 4532-1234-5678-9012';

      // Act
      const result = piiRedactor.redactQuery(text);

      // Assert
      expect(result.sanitizedText).not.toContain('john@example.com');
      expect(result.sanitizedText).not.toContain('555-123-4567');
      expect(result.sanitizedText).not.toContain('4532-1234-5678-9012');
      expect(result.tokens.size).toBe(3);
    });

    it('should preserve non-PII content', () => {
      // Arrange
      const text = 'This is a normal message about products and services without sensitive data';

      // Act
      const result = piiRedactor.redactQuery(text);

      // Assert
      expect(result.sanitizedText).toBe(text);
      expect(result.tokens.size).toBe(0);
    });
  });

  describe('User Data Tokenization', () => {
    it('should tokenize sensitive fields in user context', () => {
      // Arrange
      const userData = {
        preferences: { theme: 'dark' },
        purchaseHistory: ['item1', 'item2'],
        currentCart: [],
        demographics: {
          email: 'user@example.com',
          phone: '555-123-4567',
          firstName: 'John',
          lastName: 'Doe',
          address: '123 Main St',
        },
      };

      // Act
      const result = piiRedactor.tokenizeUserData(userData);



      // Assert
      expect(result.tokenizedData.demographics.email).toMatch(/\[USER_TOKEN_[a-f0-9]{8}\]/);
      expect(result.tokenizedData.demographics.phone).toMatch(/\[USER_TOKEN_[a-f0-9]{8}\]/);
      expect(result.tokenizedData.demographics.firstName).toMatch(/\[USER_TOKEN_[a-f0-9]{8}\]/);
      expect(result.tokenizedData.demographics.lastName).toMatch(/\[USER_TOKEN_[a-f0-9]{8}\]/);
      expect(result.tokenizedData.demographics.address).toMatch(/\[USER_TOKEN_[a-f0-9]{8}\]/);
      
      // Non-sensitive fields should remain unchanged
      expect(result.tokenizedData.preferences.theme).toBe('dark');
      expect(result.tokenizedData.purchaseHistory).toEqual(['item1', 'item2']);
      
      expect(result.tokenMap.size).toBe(5);
    });

    it('should handle nested objects with sensitive data', () => {
      // Arrange
      const userData = {
        profile: {
          personal: {
            email: 'user@example.com',
            fullName: 'John Doe',
          },
          billing: {
            creditCard: '4532-1234-5678-9012',
            address: '123 Main Street',
          },
        },
      };

      // Act
      const result = piiRedactor.tokenizeUserData(userData);

      // Assert
      expect(result.tokenizedData.profile.personal.email).toMatch(/\[USER_TOKEN_[a-f0-9]{8}\]/);
      expect(result.tokenizedData.profile.personal.fullName).toMatch(/\[USER_TOKEN_[a-f0-9]{8}\]/);
      expect(result.tokenizedData.profile.billing.creditCard).toMatch(/\[USER_TOKEN_[a-f0-9]{8}\]/);
      expect(result.tokenizedData.profile.billing.address).toMatch(/\[USER_TOKEN_[a-f0-9]{8}\]/);
      expect(result.tokenMap.size).toBe(4);
    });
  });

  describe('Response Sanitization', () => {
    it('should sanitize PII from response text', () => {
      // Arrange
      const response = 'Your order will be shipped to john@example.com at 123 Main Street. Call 555-123-4567 for updates.';

      // Act
      const sanitized = piiRedactor.sanitizeResponse(response);

      // Assert
      expect(sanitized).not.toContain('john@example.com');
      expect(sanitized).not.toContain('123 Main Street');
      expect(sanitized).not.toContain('555-123-4567');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should preserve non-PII content in responses', () => {
      // Arrange
      const response = 'Your order has been processed successfully. Thank you for your purchase!';

      // Act
      const sanitized = piiRedactor.sanitizeResponse(response);

      // Assert
      expect(sanitized).toBe(response);
    });
  });

  describe('Secure Token Management with KMS', () => {
    it('should create secure tokens using KMS encryption', async () => {
      // Arrange
      const mockEncryptResult = {
        CiphertextBlob: Buffer.from('encrypted-data', 'base64'),
      };
      mockKMS.encrypt.mockReturnValue({
        promise: () => Promise.resolve(mockEncryptResult),
      });
      mockDynamoDB.putItem.mockReturnValue({
        promise: () => Promise.resolve({}),
      });

      // Act
      const token = await piiRedactor.createSecureToken(
        'sensitive-data',
        'personal',
        'merchant123',
        'user456',
        24
      );

      // Assert
      expect(token).toMatch(/^personal_[a-f0-9]{32}$/);
      expect(mockKMS.encrypt).toHaveBeenCalledWith({
        KeyId: expect.any(String),
        Plaintext: Buffer.from('sensitive-data', 'utf8'),
        EncryptionContext: expect.objectContaining({
          token_id: token,
          merchant_id: 'merchant123',
          data_type: 'personal',
        }),
      });
      expect(mockDynamoDB.putItem).toHaveBeenCalled();
    });

    it('should retrieve original value from secure token', async () => {
      // Arrange
      const tokenId = 'personal_1234567890abcdef1234567890abcdef';
      const mockGetResult = {
        Item: {
          token_id: { S: tokenId },
          merchant_id: { S: 'merchant123' },
          encrypted_value: { S: 'encrypted-data' },
          data_type: { S: 'personal' },
          created_at: { S: new Date().toISOString() },
        },
      };
      const mockDecryptResult = {
        Plaintext: Buffer.from('original-data', 'utf8'),
      };

      mockDynamoDB.getItem.mockReturnValue({
        promise: () => Promise.resolve(mockGetResult),
      });
      mockKMS.decrypt.mockReturnValue({
        promise: () => Promise.resolve(mockDecryptResult),
      });

      // Act
      const result = await piiRedactor.retrieveFromToken(tokenId, 'merchant123');

      // Assert
      expect(result).toBe('original-data');
      expect(mockDynamoDB.getItem).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: {
          token_id: { S: tokenId },
          merchant_id: { S: 'merchant123' },
        },
      });
      expect(mockKMS.decrypt).toHaveBeenCalled();
    });

    it('should handle expired tokens', async () => {
      // Arrange
      const tokenId = 'personal_1234567890abcdef1234567890abcdef';
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      const mockGetResult = {
        Item: {
          token_id: { S: tokenId },
          merchant_id: { S: 'merchant123' },
          encrypted_value: { S: 'encrypted-data' },
          data_type: { S: 'personal' },
          created_at: { S: new Date().toISOString() },
          expires_at: { S: expiredDate.toISOString() },
        },
      };

      mockDynamoDB.getItem.mockReturnValue({
        promise: () => Promise.resolve(mockGetResult),
      });
      mockDynamoDB.deleteItem.mockReturnValue({
        promise: () => Promise.resolve({}),
      });

      // Act
      const result = await piiRedactor.retrieveFromToken(tokenId, 'merchant123');

      // Assert
      expect(result).toBeNull();
      expect(mockDynamoDB.deleteItem).toHaveBeenCalled();
    });

    it('should handle non-existent tokens', async () => {
      // Arrange
      const tokenId = 'personal_nonexistent';
      mockDynamoDB.getItem.mockReturnValue({
        promise: () => Promise.resolve({}), // No Item
      });

      // Act
      const result = await piiRedactor.retrieveFromToken(tokenId, 'merchant123');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Payment Data Tokenization', () => {
    it('should tokenize payment information securely', async () => {
      // Arrange
      const paymentData = {
        card_number: '4532-1234-5678-9012',
        cvv: '123',
        expiry_date: '12/25',
        payment_method_id: 'pm_1234567890',
        billing_address: {
          street: '123 Main St',
          city: 'Anytown',
          zip: '12345',
        },
      };

      mockKMS.encrypt.mockReturnValue({
        promise: () => Promise.resolve({
          CiphertextBlob: Buffer.from('encrypted-data', 'base64'),
        }),
      });
      mockDynamoDB.putItem.mockReturnValue({
        promise: () => Promise.resolve({}),
      });

      // Act
      const result = await piiRedactor.tokenizePaymentData(
        paymentData,
        'merchant123',
        'user456'
      );

      // Assert
      expect(result.tokenized_data.card_number).toMatch(/^payment_[a-f0-9]{32}$/);
      expect(result.tokenized_data.cvv).toMatch(/^payment_[a-f0-9]{32}$/);
      expect(result.tokenized_data.expiry_date).toMatch(/^payment_[a-f0-9]{32}$/);
      expect(result.tokenized_data.payment_method_id).toMatch(/^payment_[a-f0-9]{32}$/);
      expect(result.tokenized_data.billing_address).toMatch(/^payment_[a-f0-9]{32}$/);
      
      expect(result.token_mappings).toHaveLength(5);
      expect(result.token_mappings[0].data_classification).toBe('payment');
    });

    it('should handle payment tokenization failures gracefully', async () => {
      // Arrange
      const paymentData = {
        card_number: '4532-1234-5678-9012',
        cvv: '123',
        non_critical_field: 'some-value',
      };

      mockKMS.encrypt
        .mockReturnValueOnce({
          promise: () => Promise.reject(new Error('KMS error')),
        })
        .mockReturnValueOnce({
          promise: () => Promise.reject(new Error('KMS error')),
        });

      // Act & Assert - Should throw for critical fields
      await expect(
        piiRedactor.tokenizePaymentData(paymentData, 'merchant123', 'user456')
      ).rejects.toThrow('Critical payment field tokenization failed: card_number');
    });
  });

  describe('Conversation Log Sanitization', () => {
    it('should sanitize conversation logs before persistence', async () => {
      // Arrange
      const conversationData = {
        user_message: 'My email is john@example.com and phone is 555-123-4567',
        assistant_response: 'Thank you for providing your contact information.',
        context: {
          user_email: 'john@example.com',
          session_id: 'session123',
        },
        metadata: {
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0...',
        },
      };

      mockKMS.encrypt.mockReturnValue({
        promise: () => Promise.resolve({
          CiphertextBlob: Buffer.from('encrypted-data', 'base64'),
        }),
      });
      mockDynamoDB.putItem.mockReturnValue({
        promise: () => Promise.resolve({}),
      });

      // Act
      const result = await piiRedactor.sanitizeConversationLog(
        conversationData,
        'merchant123'
      );

      // Assert
      expect(result.sanitized_conversation.user_message).not.toContain('john@example.com');
      expect(result.sanitized_conversation.user_message).not.toContain('555-123-4567');
      expect(result.sanitized_conversation.redaction_applied).toBe(true);
      
      expect(result.redaction_summary.fields_redacted).toContain('user_message');
      expect(result.redaction_summary.fields_redacted).toContain('context');
      expect(result.redaction_summary.pii_patterns_found).toBe(2);
    });

    it('should preserve non-sensitive conversation data', async () => {
      // Arrange
      const conversationData = {
        user_message: 'What are your store hours?',
        assistant_response: 'We are open Monday through Friday from 9 AM to 6 PM.',
        context: {
          session_id: 'session123',
          timestamp: new Date().toISOString(),
        },
      };

      // Act
      const result = await piiRedactor.sanitizeConversationLog(
        conversationData,
        'merchant123'
      );

      // Assert
      expect(result.sanitized_conversation.user_message).toBe(conversationData.user_message);
      expect(result.sanitized_conversation.assistant_response).toBe(conversationData.assistant_response);
      expect(result.sanitized_conversation.redaction_applied).toBe(false);
      expect(result.redaction_summary.fields_redacted).toHaveLength(0);
    });
  });

  describe('Security Edge Cases and Attack Vectors', () => {
    it('should handle malformed PII patterns', () => {
      // Arrange
      const text = 'Email: user@domain@com Phone: 555-123-45678 Card: 4532-1234-5678';

      // Act
      const result = piiRedactor.redactQuery(text);

      // Assert - Should not crash on malformed patterns
      expect(result.sanitizedText).toBeDefined();
      expect(result.tokens).toBeDefined();
    });

    it('should prevent token collision attacks', async () => {
      // Arrange
      const data1 = 'sensitive-data-1';
      const data2 = 'sensitive-data-2';

      mockKMS.encrypt.mockReturnValue({
        promise: () => Promise.resolve({
          CiphertextBlob: Buffer.from('encrypted-data', 'base64'),
        }),
      });
      mockDynamoDB.putItem.mockReturnValue({
        promise: () => Promise.resolve({}),
      });

      // Act
      const token1 = await piiRedactor.createSecureToken(data1, 'personal', 'merchant123');
      const token2 = await piiRedactor.createSecureToken(data2, 'personal', 'merchant123');

      // Assert - Tokens should be unique
      expect(token1).not.toBe(token2);
      expect(token1).toMatch(/^personal_[a-f0-9]{32}$/);
      expect(token2).toMatch(/^personal_[a-f0-9]{32}$/);
    });

    it('should handle large text inputs efficiently', () => {
      // Arrange
      const largeText = 'Contact us at '.repeat(1000) + 'user@example.com';

      // Act
      const startTime = Date.now();
      const result = piiRedactor.redactQuery(largeText);
      const endTime = Date.now();

      // Assert - Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
      expect(result.sanitizedText).not.toContain('user@example.com');
      expect(result.tokens.size).toBe(1);
    });

    it('should prevent cross-tenant token access', async () => {
      // Arrange
      const tokenId = 'personal_1234567890abcdef1234567890abcdef';
      mockDynamoDB.getItem.mockReturnValue({
        promise: () => Promise.resolve({}), // No item found
      });

      // Act
      const result = await piiRedactor.retrieveFromToken(tokenId, 'wrong-merchant');

      // Assert
      expect(result).toBeNull();
      expect(mockDynamoDB.getItem).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: {
          token_id: { S: tokenId },
          merchant_id: { S: 'wrong-merchant' },
        },
      });
    });

    it('should handle KMS service failures gracefully', async () => {
      // Arrange
      mockKMS.encrypt.mockReturnValue({
        promise: () => Promise.reject(new Error('KMS service unavailable')),
      });

      // Act & Assert
      await expect(
        piiRedactor.createSecureToken('sensitive-data', 'personal', 'merchant123')
      ).rejects.toThrow('Token creation failed: KMS service unavailable');
    });

    it('should validate encryption context integrity', async () => {
      // Arrange
      const tokenId = 'personal_1234567890abcdef1234567890abcdef';
      const mockGetResult = {
        Item: {
          token_id: { S: tokenId },
          merchant_id: { S: 'merchant123' },
          encrypted_value: { S: 'encrypted-data' },
          data_type: { S: 'personal' },
          created_at: { S: new Date().toISOString() },
        },
      };

      mockDynamoDB.getItem.mockReturnValue({
        promise: () => Promise.resolve(mockGetResult),
      });
      mockKMS.decrypt.mockReturnValue({
        promise: () => Promise.reject(new Error('Invalid encryption context')),
      });

      // Act
      const result = await piiRedactor.retrieveFromToken(tokenId, 'merchant123');

      // Assert
      expect(result).toBeNull();
      expect(mockKMS.decrypt).toHaveBeenCalledWith({
        CiphertextBlob: expect.any(Buffer),
        EncryptionContext: {
          token_id: tokenId,
          merchant_id: 'merchant123',
          data_type: 'personal',
        },
      });
    });
  });
});