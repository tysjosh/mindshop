/**
 * Unit Tests for Cognito Lambda Triggers
 * Tests the Post-Confirmation and Pre-Token-Generation Lambda functions
 * 
 * Requirements: 1.5, 3.1, 3.2, 4.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock functions
const mockSend = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn();
const mockPoolQuery = vi.fn();
const mockPoolEnd = vi.fn();

// Mock pg Pool before importing the handler
vi.mock('pg', () => {
  return {
    Pool: vi.fn().mockImplementation(() => ({
      connect: mockConnect,
      query: mockPoolQuery,
      end: mockPoolEnd,
    })),
  };
});

// Mock AWS SDK
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: vi.fn(() => ({
    send: mockSend,
  })),
  AdminUpdateUserAttributesCommand: vi.fn((params) => params),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'testuuid123456789'),
}));

describe('Cognito Post-Confirmation Lambda Trigger', () => {
  let handler: any;
  let mockClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mock database client
    mockClient = {
      query: mockClientQuery,
      release: mockRelease,
    };
    
    mockConnect.mockResolvedValue(mockClient);
    
    // Set environment variables
    process.env.DB_HOST = 'localhost';
    process.env.DB_NAME = 'test_db';
    process.env.DB_USER = 'test_user';
    process.env.DB_PASSWORD = 'test_password';
    process.env.DB_PORT = '5432';
    process.env.DB_SSL = 'false';
    process.env.AWS_REGION = 'us-east-2';
    
    // Dynamically import the handler to get fresh instance
    vi.resetModules();
    const module = await import('../../lambda-functions/cognito-post-confirmation/index.js');
    handler = module.handler;
  });

  describe('Merchant Creation Logic', () => {
    it('should create merchant record with generated merchant_id', async () => {
      const event = {
        userPoolId: 'us-east-2_TestPool',
        userName: 'test-user-123',
        request: {
          userAttributes: {
            email: 'test@example.com',
            'custom:company_name': 'Test Company',
          },
        },
      };

      const context = {
        requestId: 'test-request-123',
      };

      // Mock successful database operations
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // INSERT
          rows: [{
            merchant_id: 'merchant_testuuid123456789',
            company_name: 'Test Company',
            email: 'test@example.com',
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock successful Cognito update
      mockSend.mockResolvedValue({});

      const result = await handler(event, context);

      // Verify merchant was created with correct data
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO merchants'),
        expect.arrayContaining([
          expect.stringContaining('merchant_'),
          'Test Company',
          'test@example.com',
          'test-user-123',
          'active',
        ])
      );

      // Verify transaction was committed
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');

      // Verify event was returned
      expect(result).toEqual(event);
    });

    it('should use email prefix as company name when custom:company_name is not provided', async () => {
      const event = {
        userPoolId: 'us-east-2_TestPool',
        userName: 'test-user-456',
        request: {
          userAttributes: {
            email: 'john.doe@example.com',
          },
        },
      };

      const context = { requestId: 'test-request-456' };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ merchant_id: 'merchant_test' }] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockSend.mockResolvedValue({});

      await handler(event, context);

      // Verify company name was derived from email
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO merchants'),
        expect.arrayContaining([
          expect.anything(),
          expect.stringMatching(/john/i),
          'john.doe@example.com',
          'test-user-456',
          'active',
        ])
      );
    });

    it('should generate unique merchant_id for each user', async () => {
      const event = {
        userPoolId: 'us-east-2_TestPool',
        userName: 'test-user-789',
        request: {
          userAttributes: {
            email: 'unique@example.com',
          },
        },
      };

      const context = { requestId: 'test-request-789' };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ merchant_id: 'merchant_testuuid123456789' }] })
        .mockResolvedValueOnce({ rows: [] });

      mockSend.mockResolvedValue({});

      await handler(event, context);

      // Verify merchant_id starts with 'merchant_' and contains UUID
      const insertCall = mockClientQuery.mock.calls.find((call: any) => 
        call[0].includes('INSERT INTO merchants')
      );
      expect(insertCall[1][0]).toMatch(/^merchant_[a-f0-9]{32}$/);
    });
  });

  describe('Cognito Attribute Assignment', () => {
    it('should update Cognito user with merchant_id and roles', async () => {
      const event = {
        userPoolId: 'us-east-2_TestPool',
        userName: 'test-user-abc',
        request: {
          userAttributes: {
            email: 'test@example.com',
          },
        },
      };

      const context = { requestId: 'test-request-abc' };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ merchant_id: 'merchant_testuuid123456789' }] })
        .mockResolvedValueOnce({ rows: [] });

      mockSend.mockResolvedValue({});

      await handler(event, context);

      // Verify Cognito update was called with correct attributes
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          UserPoolId: 'us-east-2_TestPool',
          Username: 'test-user-abc',
          UserAttributes: expect.arrayContaining([
            expect.objectContaining({
              Name: 'custom:merchant_id',
              Value: expect.stringMatching(/^merchant_/),
            }),
            expect.objectContaining({
              Name: 'custom:roles',
              Value: 'merchant_user,merchant_admin',
            }),
          ]),
        })
      );
    });

    it('should assign default roles to new users', async () => {
      const event = {
        userPoolId: 'us-east-2_TestPool',
        userName: 'new-user',
        request: {
          userAttributes: {
            email: 'newuser@example.com',
          },
        },
      };

      const context = { requestId: 'test-request-new' };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ merchant_id: 'merchant_new' }] })
        .mockResolvedValueOnce({ rows: [] });

      mockSend.mockResolvedValue({});

      await handler(event, context);

      // Verify default roles were assigned
      const cognitoCall = mockSend.mock.calls[0][0];
      const rolesAttribute = cognitoCall.UserAttributes.find(
        (attr: any) => attr.Name === 'custom:roles'
      );
      expect(rolesAttribute.Value).toBe('merchant_user,merchant_admin');
    });
  });

  describe('Error Handling', () => {
    it('should rollback database transaction on error', async () => {
      const event = {
        userPoolId: 'us-east-2_TestPool',
        userName: 'error-user',
        request: {
          userAttributes: {
            email: 'error@example.com',
          },
        },
      };

      const context = { requestId: 'test-request-error' };

      // Mock database error during INSERT
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database connection failed')) // INSERT fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(handler(event, context)).rejects.toThrow();

      // Verify ROLLBACK was called
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle duplicate merchant scenario', async () => {
      const event = {
        userPoolId: 'us-east-2_TestPool',
        userName: 'duplicate-user',
        request: {
          userAttributes: {
            email: 'duplicate@example.com',
          },
        },
      };

      const context = { requestId: 'test-request-duplicate' };

      // Mock unique constraint violation
      const duplicateError: any = new Error('Duplicate key violation');
      duplicateError.code = '23505';

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(duplicateError); // INSERT fails with duplicate

      // Mock check for existing merchant on the pool
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ merchant_id: 'merchant_existing123' }],
      });

      // Mock successful Cognito update
      mockSend.mockResolvedValue({});

      const result = await handler(event, context);

      // Verify it recovered by updating Cognito with existing merchant_id
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          UserAttributes: expect.arrayContaining([
            expect.objectContaining({
              Name: 'custom:merchant_id',
              Value: 'merchant_existing123',
            }),
          ]),
        })
      );

      expect(result).toEqual(event);
    });

    it('should delete merchant record if Cognito update fails', async () => {
      const event = {
        userPoolId: 'us-east-2_TestPool',
        userName: 'cognito-fail-user',
        request: {
          userAttributes: {
            email: 'cognitofail@example.com',
          },
        },
      };

      const context = { requestId: 'test-request-cognito-fail' };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ merchant_id: 'merchant_todelete' }] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock Cognito update failure
      mockSend.mockRejectedValue(new Error('Cognito service unavailable'));

      // Mock successful delete on the pool
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await expect(handler(event, context)).rejects.toThrow();

      // Verify merchant was deleted
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM merchants'),
        expect.arrayContaining([expect.stringContaining('merchant_')])
      );
    });

    it('should release database client even on error', async () => {
      const event = {
        userPoolId: 'us-east-2_TestPool',
        userName: 'release-test-user',
        request: {
          userAttributes: {
            email: 'release@example.com',
          },
        },
      };

      const context = { requestId: 'test-request-release' };

      mockClientQuery.mockRejectedValue(new Error('Database error'));

      await expect(handler(event, context)).rejects.toThrow();

      // Verify client was released
      expect(mockRelease).toHaveBeenCalled();
    });
  });
});

describe('Cognito Pre-Token-Generation Lambda Trigger', () => {
  let handler: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Dynamically import the handler
    const module = await import('../../lambda-functions/cognito-pre-token-generation/index.js');
    handler = module.handler;
  });

  describe('Custom Claims Addition', () => {
    it('should add merchant_id to token claims', async () => {
      const event = {
        userName: 'test-user',
        request: {
          userAttributes: {
            'custom:merchant_id': 'merchant_abc123',
            'custom:roles': 'merchant_user,merchant_admin',
            'email_verified': 'true',
          },
        },
        response: {},
      };

      const context = { requestId: 'test-request-token' };

      const result = await handler(event, context);

      expect(result.response.claimsOverrideDetails).toBeDefined();
      expect(result.response.claimsOverrideDetails.claimsToAddOrOverride).toEqual({
        merchant_id: 'merchant_abc123',
        roles: 'merchant_user,merchant_admin',
        email_verified: 'true',
      });
    });

    it('should add roles to token claims', async () => {
      const event = {
        userName: 'test-user-roles',
        request: {
          userAttributes: {
            'custom:merchant_id': 'merchant_xyz789',
            'custom:roles': 'merchant_admin,super_admin',
            'email_verified': 'true',
          },
        },
        response: {},
      };

      const context = { requestId: 'test-request-roles' };

      const result = await handler(event, context);

      expect(result.response.claimsOverrideDetails.claimsToAddOrOverride.roles).toBe(
        'merchant_admin,super_admin'
      );
    });

    it('should add email_verified to token claims', async () => {
      const event = {
        userName: 'test-user-verified',
        request: {
          userAttributes: {
            'custom:merchant_id': 'merchant_verified',
            'custom:roles': 'merchant_user',
            'email_verified': 'true',
          },
        },
        response: {},
      };

      const context = { requestId: 'test-request-verified' };

      const result = await handler(event, context);

      expect(result.response.claimsOverrideDetails.claimsToAddOrOverride.email_verified).toBe(
        'true'
      );
    });

    it('should use default role when custom:roles is not set', async () => {
      const event = {
        userName: 'test-user-default',
        request: {
          userAttributes: {
            'custom:merchant_id': 'merchant_default',
            'email_verified': 'false',
          },
        },
        response: {},
      };

      const context = { requestId: 'test-request-default' };

      const result = await handler(event, context);

      expect(result.response.claimsOverrideDetails.claimsToAddOrOverride.roles).toBe(
        'merchant_user'
      );
    });

    it('should handle missing merchant_id gracefully', async () => {
      const event = {
        userName: 'test-user-no-merchant',
        request: {
          userAttributes: {
            'custom:roles': 'merchant_user',
            'email_verified': 'true',
          },
        },
        response: {},
      };

      const context = { requestId: 'test-request-no-merchant' };

      const result = await handler(event, context);

      // Should still return event with empty merchant_id
      expect(result.response.claimsOverrideDetails.claimsToAddOrOverride.merchant_id).toBe('');
    });
  });

  describe('Error Handling', () => {
    it('should return event even if error occurs', async () => {
      const event = {
        userName: 'test-user-error',
        request: {
          userAttributes: null as any, // Force error
        },
        response: {},
      };

      const context = { requestId: 'test-request-error' };

      // Should not throw, should return event
      const result = await handler(event, context);

      expect(result).toBeDefined();
      expect(result.userName).toBe('test-user-error');
    });

    it('should handle undefined userAttributes', async () => {
      const event = {
        userName: 'test-user-undefined',
        request: {} as any,
        response: {},
      };

      const context = { requestId: 'test-request-undefined' };

      const result = await handler(event, context);

      // Should return event without throwing
      expect(result).toBeDefined();
    });
  });
});
