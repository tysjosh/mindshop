import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MerchantService } from '../MerchantService';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getMerchantRepository } from '../../repositories/MerchantRepository';
import { getMerchantSettingsRepository } from '../../repositories/MerchantSettingsRepository';

// Mock AWS SDK
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: vi.fn(),
  SignUpCommand: vi.fn(),
  ConfirmSignUpCommand: vi.fn(),
  InitiateAuthCommand: vi.fn(),
  ForgotPasswordCommand: vi.fn(),
  ConfirmForgotPasswordCommand: vi.fn(),
  AdminGetUserCommand: vi.fn(),
  AdminUpdateUserAttributesCommand: vi.fn(),
  ResendConfirmationCodeCommand: vi.fn(),
}));

// Mock repositories
vi.mock('../../repositories/MerchantRepository', () => ({
  getMerchantRepository: vi.fn(),
}));

vi.mock('../../repositories/MerchantSettingsRepository', () => ({
  getMerchantSettingsRepository: vi.fn(),
}));

describe('MerchantService', () => {
  let merchantService: MerchantService;
  let mockCognitoClient: any;
  let mockMerchantRepository: any;
  let mockMerchantSettingsRepository: any;

  beforeEach(() => {
    // Setup mock Cognito client
    mockCognitoClient = {
      send: vi.fn(),
    };
    (CognitoIdentityProviderClient as any).mockImplementation(() => mockCognitoClient);

    // Setup mock repositories
    mockMerchantRepository = {
      findByEmail: vi.fn(),
      findByMerchantId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      markAsVerified: vi.fn(),
    };
    (getMerchantRepository as any).mockReturnValue(mockMerchantRepository);

    mockMerchantSettingsRepository = {
      create: vi.fn(),
    };
    (getMerchantSettingsRepository as any).mockReturnValue(mockMerchantSettingsRepository);

    // Set environment variables
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_TEST123';
    process.env.COGNITO_CLIENT_ID = 'test-client-id';
    process.env.COGNITO_REGION = 'us-east-1';

    merchantService = new MerchantService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new merchant', async () => {
      // Arrange
      const registerData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        companyName: 'Test Company',
        website: 'https://test.com',
        industry: 'Technology',
      };

      mockMerchantRepository.findByEmail.mockResolvedValue(null);
      mockCognitoClient.send.mockResolvedValue({
        UserSub: 'cognito-user-123',
      });
      mockMerchantRepository.create.mockResolvedValue({
        id: 'uuid-123',
        merchantId: 'test_company_123456',
        cognitoUserId: 'cognito-user-123',
        email: registerData.email,
        companyName: registerData.companyName,
        website: registerData.website,
        industry: registerData.industry,
        status: 'pending_verification',
        plan: 'starter',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockMerchantSettingsRepository.create.mockResolvedValue({});

      // Act
      const result = await merchantService.register(registerData);

      // Assert
      expect(result).toHaveProperty('merchantId');
      expect(result).toHaveProperty('email', registerData.email);
      expect(result).toHaveProperty('cognitoUserId', 'cognito-user-123');
      expect(mockMerchantRepository.findByEmail).toHaveBeenCalledWith(registerData.email);
      expect(mockCognitoClient.send).toHaveBeenCalled();
      expect(mockMerchantRepository.create).toHaveBeenCalled();
      expect(mockMerchantSettingsRepository.create).toHaveBeenCalled();
    });

    it('should throw error if email already exists', async () => {
      // Arrange
      const registerData = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        companyName: 'Test Company',
      };

      mockMerchantRepository.findByEmail.mockResolvedValue({
        id: 'existing-uuid',
        merchantId: 'existing_merchant',
        email: registerData.email,
      });

      // Act & Assert
      await expect(merchantService.register(registerData)).rejects.toThrow('Email already registered');
      expect(mockCognitoClient.send).not.toHaveBeenCalled();
    });

    it('should generate valid merchant ID from company name', async () => {
      // Arrange
      const registerData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        companyName: 'My Test Company Inc.',
      };

      mockMerchantRepository.findByEmail.mockResolvedValue(null);
      mockCognitoClient.send.mockResolvedValue({
        UserSub: 'cognito-user-123',
      });
      mockMerchantRepository.create.mockImplementation((data) => Promise.resolve(data));
      mockMerchantSettingsRepository.create.mockResolvedValue({});

      // Act
      const result = await merchantService.register(registerData);

      // Assert
      expect(result.merchantId).toMatch(/^my_test_company_inc_\d{6}$/);
    });
  });

  describe('verifyEmail', () => {
    it('should successfully verify email', async () => {
      // Arrange
      const verifyData = {
        email: 'test@example.com',
        code: '123456',
      };

      mockCognitoClient.send.mockResolvedValue({});
      mockMerchantRepository.findByEmail.mockResolvedValue({
        merchantId: 'test_merchant',
        email: verifyData.email,
      });
      mockMerchantRepository.markAsVerified.mockResolvedValue({});

      // Act
      await merchantService.verifyEmail(verifyData);

      // Assert
      expect(mockCognitoClient.send).toHaveBeenCalled();
      expect(mockMerchantRepository.findByEmail).toHaveBeenCalledWith(verifyData.email);
      expect(mockMerchantRepository.markAsVerified).toHaveBeenCalledWith('test_merchant');
    });

    it('should handle verification even if merchant not found in database', async () => {
      // Arrange
      const verifyData = {
        email: 'test@example.com',
        code: '123456',
      };

      mockCognitoClient.send.mockResolvedValue({});
      mockMerchantRepository.findByEmail.mockResolvedValue(null);

      // Act
      await merchantService.verifyEmail(verifyData);

      // Assert
      expect(mockCognitoClient.send).toHaveBeenCalled();
      expect(mockMerchantRepository.markAsVerified).not.toHaveBeenCalled();
    });
  });

  describe('resendVerificationCode', () => {
    it('should successfully resend verification code', async () => {
      // Arrange
      const email = 'test@example.com';
      mockCognitoClient.send.mockResolvedValue({});

      // Act
      await merchantService.resendVerificationCode(email);

      // Assert
      expect(mockCognitoClient.send).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should successfully login and return tokens', async () => {
      // Arrange
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      mockCognitoClient.send.mockResolvedValue({
        AuthenticationResult: {
          AccessToken: 'access-token-123',
          IdToken: 'id-token-123',
          RefreshToken: 'refresh-token-123',
          ExpiresIn: 3600,
        },
      });

      mockMerchantRepository.findByEmail.mockResolvedValue({
        merchantId: 'test_merchant',
        email: loginData.email,
      });

      // Act
      const result = await merchantService.login(loginData);

      // Assert
      expect(result).toHaveProperty('accessToken', 'access-token-123');
      expect(result).toHaveProperty('idToken', 'id-token-123');
      expect(result).toHaveProperty('refreshToken', 'refresh-token-123');
      expect(result).toHaveProperty('expiresIn', 3600);
      expect(result).toHaveProperty('merchantId', 'test_merchant');
      expect(result).toHaveProperty('email', loginData.email);
    });

    it('should throw error if authentication fails', async () => {
      // Arrange
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      mockCognitoClient.send.mockResolvedValue({
        AuthenticationResult: null,
      });

      // Act & Assert
      await expect(merchantService.login(loginData)).rejects.toThrow('Authentication failed');
    });

    it('should throw error if merchant not found', async () => {
      // Arrange
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      mockCognitoClient.send.mockResolvedValue({
        AuthenticationResult: {
          AccessToken: 'access-token-123',
          IdToken: 'id-token-123',
          RefreshToken: 'refresh-token-123',
          ExpiresIn: 3600,
        },
      });

      mockMerchantRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(merchantService.login(loginData)).rejects.toThrow('Merchant not found');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh access token', async () => {
      // Arrange
      const refreshData = {
        refreshToken: 'refresh-token-123',
      };

      mockCognitoClient.send.mockResolvedValue({
        AuthenticationResult: {
          AccessToken: 'new-access-token',
          IdToken: 'new-id-token',
          ExpiresIn: 3600,
        },
      });

      // Act
      const result = await merchantService.refreshToken(refreshData);

      // Assert
      expect(result).toHaveProperty('accessToken', 'new-access-token');
      expect(result).toHaveProperty('idToken', 'new-id-token');
      expect(result).toHaveProperty('expiresIn', 3600);
    });

    it('should throw error if token refresh fails', async () => {
      // Arrange
      const refreshData = {
        refreshToken: 'invalid-refresh-token',
      };

      mockCognitoClient.send.mockResolvedValue({
        AuthenticationResult: null,
      });

      // Act & Assert
      await expect(merchantService.refreshToken(refreshData)).rejects.toThrow('Token refresh failed');
    });
  });

  describe('forgotPassword', () => {
    it('should successfully initiate forgot password flow', async () => {
      // Arrange
      const forgotData = {
        email: 'test@example.com',
      };

      mockCognitoClient.send.mockResolvedValue({});

      // Act
      await merchantService.forgotPassword(forgotData);

      // Assert
      expect(mockCognitoClient.send).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password', async () => {
      // Arrange
      const resetData = {
        email: 'test@example.com',
        code: '123456',
        newPassword: 'NewSecurePass123!',
      };

      mockCognitoClient.send.mockResolvedValue({});

      // Act
      await merchantService.resetPassword(resetData);

      // Assert
      expect(mockCognitoClient.send).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should successfully get merchant profile', async () => {
      // Arrange
      const merchantId = 'test_merchant';
      const mockMerchant = {
        merchantId,
        email: 'test@example.com',
        companyName: 'Test Company',
        website: 'https://test.com',
        industry: 'Technology',
        status: 'active',
        plan: 'professional',
        createdAt: new Date('2024-01-01'),
        verifiedAt: new Date('2024-01-02'),
      };

      mockMerchantRepository.findByMerchantId.mockResolvedValue(mockMerchant);
      mockCognitoClient.send.mockResolvedValue({
        Username: mockMerchant.email,
        UserAttributes: [],
      });

      // Act
      const result = await merchantService.getProfile(merchantId);

      // Assert
      expect(result).toHaveProperty('merchantId', merchantId);
      expect(result).toHaveProperty('email', mockMerchant.email);
      expect(result).toHaveProperty('companyName', mockMerchant.companyName);
      expect(result).toHaveProperty('website', mockMerchant.website);
      expect(result).toHaveProperty('industry', mockMerchant.industry);
      expect(result).toHaveProperty('status', mockMerchant.status);
      expect(result).toHaveProperty('plan', mockMerchant.plan);
    });

    it('should throw error if merchant not found', async () => {
      // Arrange
      const merchantId = 'nonexistent_merchant';
      mockMerchantRepository.findByMerchantId.mockResolvedValue(null);

      // Act & Assert
      await expect(merchantService.getProfile(merchantId)).rejects.toThrow('Merchant not found');
    });
  });

  describe('updateProfile', () => {
    it('should successfully update merchant profile', async () => {
      // Arrange
      const merchantId = 'test_merchant';
      const updateData = {
        companyName: 'Updated Company',
        website: 'https://updated.com',
        industry: 'Finance',
      };

      const mockMerchant = {
        merchantId,
        email: 'test@example.com',
        companyName: 'Test Company',
        status: 'active',
        plan: 'starter',
        createdAt: new Date(),
      };

      const mockUpdatedMerchant = {
        ...mockMerchant,
        ...updateData,
        updatedAt: new Date(),
      };

      mockMerchantRepository.findByMerchantId.mockResolvedValue(mockMerchant);
      mockMerchantRepository.update.mockResolvedValue(mockUpdatedMerchant);
      mockCognitoClient.send.mockResolvedValue({});

      // Act
      const result = await merchantService.updateProfile(merchantId, updateData);

      // Assert
      expect(result).toHaveProperty('companyName', updateData.companyName);
      expect(result).toHaveProperty('website', updateData.website);
      expect(result).toHaveProperty('industry', updateData.industry);
      expect(mockMerchantRepository.update).toHaveBeenCalledWith(merchantId, updateData);
      expect(mockCognitoClient.send).toHaveBeenCalled(); // Should update Cognito attributes
    });

    it('should update only provided fields', async () => {
      // Arrange
      const merchantId = 'test_merchant';
      const updateData = {
        website: 'https://newwebsite.com',
      };

      const mockMerchant = {
        merchantId,
        email: 'test@example.com',
        companyName: 'Test Company',
        status: 'active',
        plan: 'starter',
        createdAt: new Date(),
      };

      const mockUpdatedMerchant = {
        ...mockMerchant,
        website: updateData.website,
      };

      mockMerchantRepository.findByMerchantId.mockResolvedValue(mockMerchant);
      mockMerchantRepository.update.mockResolvedValue(mockUpdatedMerchant);

      // Act
      const result = await merchantService.updateProfile(merchantId, updateData);

      // Assert
      expect(result).toHaveProperty('website', updateData.website);
      expect(mockMerchantRepository.update).toHaveBeenCalledWith(merchantId, { website: updateData.website });
      expect(mockCognitoClient.send).not.toHaveBeenCalled(); // Should not update Cognito if no company name change
    });

    it('should throw error if merchant not found', async () => {
      // Arrange
      const merchantId = 'nonexistent_merchant';
      const updateData = {
        companyName: 'Updated Company',
      };

      mockMerchantRepository.findByMerchantId.mockResolvedValue(null);

      // Act & Assert
      await expect(merchantService.updateProfile(merchantId, updateData)).rejects.toThrow('Merchant not found');
    });
  });

  describe('generateMerchantId', () => {
    it('should generate valid merchant ID with timestamp', async () => {
      // Arrange
      const registerData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        companyName: 'Test Company',
      };

      mockMerchantRepository.findByEmail.mockResolvedValue(null);
      mockCognitoClient.send.mockResolvedValue({
        UserSub: 'cognito-user-123',
      });
      mockMerchantRepository.create.mockImplementation((data) => Promise.resolve(data));
      mockMerchantSettingsRepository.create.mockResolvedValue({});

      // Act
      const result = await merchantService.register(registerData);

      // Assert
      expect(result.merchantId).toMatch(/^test_company_\d{6}$/);
    });

    it('should handle special characters in company name', async () => {
      // Arrange
      const registerData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        companyName: 'Test & Company, Inc.!',
      };

      mockMerchantRepository.findByEmail.mockResolvedValue(null);
      mockCognitoClient.send.mockResolvedValue({
        UserSub: 'cognito-user-123',
      });
      mockMerchantRepository.create.mockImplementation((data) => Promise.resolve(data));
      mockMerchantSettingsRepository.create.mockResolvedValue({});

      // Act
      const result = await merchantService.register(registerData);

      // Assert
      expect(result.merchantId).toMatch(/^test_company_inc_\d{6}$/);
      expect(result.merchantId).not.toContain('&');
      expect(result.merchantId).not.toContain(',');
      expect(result.merchantId).not.toContain('!');
    });
  });

  describe('getDefaultSettings', () => {
    it('should create merchant with default settings', async () => {
      // Arrange
      const registerData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        companyName: 'Test Company',
      };

      mockMerchantRepository.findByEmail.mockResolvedValue(null);
      mockCognitoClient.send.mockResolvedValue({
        UserSub: 'cognito-user-123',
      });
      mockMerchantRepository.create.mockResolvedValue({
        merchantId: 'test_merchant',
      });
      mockMerchantSettingsRepository.create.mockImplementation((data) => {
        expect(data.settings).toHaveProperty('widget');
        expect(data.settings).toHaveProperty('rag');
        expect(data.settings).toHaveProperty('notifications');
        expect(data.settings.widget).toHaveProperty('theme');
        expect(data.settings.widget).toHaveProperty('behavior');
        return Promise.resolve(data);
      });

      // Act
      await merchantService.register(registerData);

      // Assert
      expect(mockMerchantSettingsRepository.create).toHaveBeenCalled();
    });
  });
});
