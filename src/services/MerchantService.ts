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
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'crypto';
import { getMerchantRepository } from '../repositories/MerchantRepository';
import { getMerchantSettingsRepository } from '../repositories/MerchantSettingsRepository';

export interface RegisterMerchantData {
  email: string;
  password: string;
  companyName: string;
  website?: string;
  industry?: string;
}

export interface VerifyEmailData {
  email: string;
  confirmationCode: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RefreshTokenData {
  refreshToken: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  email: string;
  confirmationCode: string;
  newPassword: string;
}

export interface LogoutData {
  accessToken: string;
  sessionId?: string;
}

export class MerchantService {
  private cognitoClient: CognitoIdentityProviderClient;
  private merchantRepository = getMerchantRepository();
  private merchantSettingsRepository = getMerchantSettingsRepository();

  constructor() {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Register a new merchant account
   */
  async register(data: RegisterMerchantData): Promise<{
    merchantId: string;
    email: string;
    cognitoUserId?: string;
    message: string;
  }> {
    // 1. Check if email already exists
    const existingMerchant = await this.merchantRepository.findByEmail(data.email);
    if (existingMerchant) {
      throw new Error('Email already registered');
    }

    // 2. Generate merchant ID
    const merchantId = this.generateMerchantId(data.companyName);

    // 3. Create Cognito user
    let cognitoUserId = '';
    try {
      const signUpResult = await this.cognitoClient.send(
        new SignUpCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: data.email,
          Password: data.password,
          UserAttributes: [
            { Name: 'email', Value: data.email },
            { Name: 'custom:merchant_id', Value: merchantId },
            { Name: 'custom:company_name', Value: data.companyName },
            { Name: 'custom:roles', Value: 'merchant_admin' },
          ],
        })
      );
      cognitoUserId = signUpResult.UserSub || '';
    } catch (error: any) {
      console.error('Cognito SignUp error:', error);
      throw new Error(`Failed to create account: ${error.message}`);
    }

    // 4. Create merchant record in database
    await this.merchantRepository.create({
      merchantId,
      cognitoUserId,
      email: data.email,
      companyName: data.companyName,
      website: data.website,
      industry: data.industry,
      status: 'pending_verification',
      plan: 'starter',
    });

    // 5. Initialize default settings
    await this.merchantSettingsRepository.create({
      merchantId,
      settings: this.getDefaultSettings(),
    });

    return {
      merchantId,
      email: data.email,
      cognitoUserId,
      message: 'Registration successful. Please check your email for verification code.',
    };
  }

  /**
   * Verify email with confirmation code
   */
  async verifyEmail(data: VerifyEmailData): Promise<{
    success: boolean;
    message: string;
    merchantId?: string;
  }> {
    try {
      // 1. Confirm sign up in Cognito
      await this.cognitoClient.send(
        new ConfirmSignUpCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: data.email,
          ConfirmationCode: data.confirmationCode,
        })
      );

      // 2. Get user details from Cognito to extract cognitoUserId
      const userDetails = await this.cognitoClient.send(
        new AdminGetUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID!,
          Username: data.email,
        })
      );

      const cognitoUserId = userDetails.Username || '';

      // 3. Find merchant by email
      const merchant = await this.merchantRepository.findByEmail(data.email);
      if (!merchant) {
        // If merchant not found in database, still return success
        // This can happen if database record was deleted but Cognito user still exists
        console.warn(`Merchant not found in database for email: ${data.email}`);
        return {
          success: true,
          message: 'Email verified successfully. You can now log in.',
        };
      }

      // 4. Update merchant record with cognitoUserId if needed
      if (cognitoUserId && cognitoUserId !== merchant.cognitoUserId) {
        await this.merchantRepository.update(merchant.merchantId, {
          cognitoUserId,
        });
      }

      // 5. Mark merchant as verified
      await this.merchantRepository.markAsVerified(merchant.merchantId);

      return {
        success: true,
        message: 'Email verified successfully. You can now log in.',
        merchantId: merchant.merchantId,
      };
    } catch (error: any) {
      console.error('Email verification error:', error);
      
      // Handle specific Cognito errors
      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid verification code');
      } else if (error.name === 'ExpiredCodeException') {
        throw new Error('Verification code has expired. Please request a new one.');
      } else if (error.name === 'NotAuthorizedException') {
        throw new Error('User is already confirmed');
      }
      
      throw new Error(`Email verification failed: ${error.message}`);
    }
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(email: string): Promise<{ message: string }> {
    try {
      await this.cognitoClient.send(
        new ResendConfirmationCodeCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: email,
        })
      );

      return {
        message: 'Verification code sent. Please check your email.',
      };
    } catch (error: any) {
      console.error('Resend verification code error:', error);
      throw new Error(`Failed to resend verification code: ${error.message}`);
    }
  }

  /**
   * Login merchant
   */
  async login(data: LoginData): Promise<{
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
    merchantId: string;
    email?: string;
  }> {
    try {
      // 1. Authenticate with Cognito
      const authResult = await this.cognitoClient.send(
        new InitiateAuthCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          AuthFlow: 'USER_PASSWORD_AUTH',
          AuthParameters: {
            USERNAME: data.email,
            PASSWORD: data.password,
          },
        })
      );

      if (!authResult.AuthenticationResult) {
        throw new Error('Authentication failed');
      }

      // 2. Get merchant from database
      const merchant = await this.merchantRepository.findByEmail(data.email);
      if (!merchant) {
        throw new Error('Merchant not found');
      }

      return {
        accessToken: authResult.AuthenticationResult.AccessToken!,
        idToken: authResult.AuthenticationResult.IdToken!,
        refreshToken: authResult.AuthenticationResult.RefreshToken!,
        expiresIn: authResult.AuthenticationResult.ExpiresIn || 3600,
        merchantId: merchant.merchantId,
        email: merchant.email,
      };
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle specific Cognito errors
      if (error.name === 'NotAuthorizedException') {
        throw new Error('Invalid email or password');
      } else if (error.name === 'UserNotConfirmedException') {
        throw new Error('Email not verified. Please check your email for verification code.');
      } else if (error.name === 'UserNotFoundException') {
        throw new Error('Invalid email or password');
      }
      
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(data: RefreshTokenData): Promise<{
    accessToken: string;
    idToken: string;
    expiresIn: number;
  }> {
    try {
      const authResult = await this.cognitoClient.send(
        new InitiateAuthCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          AuthParameters: {
            REFRESH_TOKEN: data.refreshToken,
          },
        })
      );

      if (!authResult.AuthenticationResult) {
        throw new Error('Token refresh failed');
      }

      return {
        accessToken: authResult.AuthenticationResult.AccessToken!,
        idToken: authResult.AuthenticationResult.IdToken!,
        expiresIn: authResult.AuthenticationResult.ExpiresIn || 3600,
      };
    } catch (error: any) {
      console.error('Token refresh error:', error);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Logout merchant and invalidate tokens
   * Requirement 7.4: Logout functionality
   */
  async logout(data: LogoutData): Promise<{ message: string }> {
    try {
      // 1. Call Cognito GlobalSignOut to invalidate all tokens
      await this.cognitoClient.send(
        new GlobalSignOutCommand({
          AccessToken: data.accessToken,
        })
      );

      // 2. If sessionId is provided, clear session data
      // Note: Session management would be handled by SessionManager if implemented
      // For now, we just invalidate the Cognito tokens

      return {
        message: 'Successfully logged out',
      };
    } catch (error: any) {
      console.error('Logout error:', error);
      
      // If token is already invalid or revoked, still return success
      if (error.name === 'NotAuthorizedException') {
        return {
          message: 'Successfully logged out',
        };
      }
      
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Initiate forgot password flow
   */
  async forgotPassword(data: ForgotPasswordData): Promise<{ message: string }> {
    try {
      await this.cognitoClient.send(
        new ForgotPasswordCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: data.email,
        })
      );

      return {
        message: 'Password reset code sent. Please check your email.',
      };
    } catch (error: any) {
      console.error('Forgot password error:', error);
      throw new Error(`Failed to initiate password reset: ${error.message}`);
    }
  }

  /**
   * Reset password with confirmation code
   */
  async resetPassword(data: ResetPasswordData): Promise<{ message: string }> {
    try {
      await this.cognitoClient.send(
        new ConfirmForgotPasswordCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: data.email,
          ConfirmationCode: data.confirmationCode,
          Password: data.newPassword,
        })
      );

      return {
        message: 'Password reset successful. You can now log in with your new password.',
      };
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      // Handle specific Cognito errors
      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid confirmation code');
      } else if (error.name === 'ExpiredCodeException') {
        throw new Error('Confirmation code has expired. Please request a new one.');
      }
      
      throw new Error(`Password reset failed: ${error.message}`);
    }
  }

  /**
   * Get merchant profile
   */
  async getProfile(merchantId: string): Promise<any> {
    const merchant = await this.merchantRepository.findByMerchantId(merchantId);
    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // Get additional details from Cognito if needed
    try {
      const userDetails = await this.cognitoClient.send(
        new AdminGetUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID!,
          Username: merchant.email,
        })
      );

      return {
        merchantId: merchant.merchantId,
        email: merchant.email,
        companyName: merchant.companyName,
        website: merchant.website,
        industry: merchant.industry,
        status: merchant.status,
        plan: merchant.plan,
        createdAt: merchant.createdAt,
        verifiedAt: merchant.verifiedAt,
        cognitoStatus: userDetails.UserStatus,
      };
    } catch (error) {
      // If Cognito call fails, return database info only
      return {
        merchantId: merchant.merchantId,
        email: merchant.email,
        companyName: merchant.companyName,
        website: merchant.website,
        industry: merchant.industry,
        status: merchant.status,
        plan: merchant.plan,
        createdAt: merchant.createdAt,
        verifiedAt: merchant.verifiedAt,
      };
    }
  }

  /**
   * Update merchant profile
   */
  async updateProfile(
    merchantId: string,
    data: {
      companyName?: string;
      website?: string;
      industry?: string;
    }
  ): Promise<any> {
    // Check if merchant exists first
    const existingMerchant = await this.merchantRepository.findByMerchantId(merchantId);
    if (!existingMerchant) {
      throw new Error('Merchant not found');
    }

    // Update database
    const merchant = await this.merchantRepository.update(merchantId, data);

    // Update Cognito attributes if company name changed
    if (data.companyName) {
      try {
        await this.cognitoClient.send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID!,
            Username: merchant.email,
            UserAttributes: [
              { Name: 'custom:company_name', Value: data.companyName },
            ],
          })
        );
      } catch (error) {
        console.error('Failed to update Cognito attributes:', error);
        // Continue even if Cognito update fails
      }
    }

    return merchant;
  }

  /**
   * Get merchant settings
   */
  async getSettings(merchantId: string): Promise<any> {
    const settings = await this.merchantSettingsRepository.findByMerchantId(merchantId);
    if (!settings) {
      throw new Error('Merchant settings not found');
    }

    return {
      merchantId: settings.merchantId,
      settings: settings.settings,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Update merchant settings
   */
  async updateSettings(
    merchantId: string,
    settings: Record<string, any>,
    partial: boolean = true
  ): Promise<any> {
    // Validate that merchant exists
    const merchant = await this.merchantRepository.findByMerchantId(merchantId);
    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // Update settings (partial merge or full replace)
    const updatedSettings = partial
      ? await this.merchantSettingsRepository.updatePartial(merchantId, settings)
      : await this.merchantSettingsRepository.update(merchantId, settings);

    return {
      merchantId: updatedSettings.merchantId,
      settings: updatedSettings.settings,
      createdAt: updatedSettings.createdAt,
      updatedAt: updatedSettings.updatedAt,
    };
  }

  /**
   * Generate merchant ID from company name
   */
  generateMerchantId(companyName: string): string {
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    const timestamp = Date.now().toString().slice(-6);
    return `${slug}_${timestamp}`;
  }

  /**
   * Delete merchant account
   */
  async deleteAccount(merchantId: string): Promise<{ message: string }> {
    // 1. Get merchant from database
    const merchant = await this.merchantRepository.findByMerchantId(merchantId);
    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // 2. Soft delete in database (mark as deleted)
    await this.merchantRepository.update(merchantId, {
      status: 'deleted',
      deletedAt: new Date(),
    });

    // 3. Optionally disable user in Cognito (don't delete to preserve audit trail)
    try {
      // Note: We're not deleting from Cognito to maintain audit trail
      // If you want to fully delete, use AdminDeleteUserCommand instead
      await this.cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID!,
          Username: merchant.email,
          UserAttributes: [
            { Name: 'custom:account_status', Value: 'deleted' },
          ],
        })
      );
    } catch (error) {
      console.error('Failed to update Cognito user status:', error);
      // Continue even if Cognito update fails
    }

    return {
      message: 'Account deleted successfully',
    };
  }

  /**
   * Get default merchant settings
   */
  private getDefaultSettings() {
    return {
      widget: {
        theme: {
          primaryColor: '#007bff',
          position: 'bottom-right',
        },
        behavior: {
          autoOpen: false,
          greeting: 'Hi! How can I help you today?',
          maxRecommendations: 3,
        },
      },
      rag: {
        maxResults: 5,
        threshold: 0.7,
      },
      notifications: {
        email: true,
        sms: false,
        webhook: false,
      },
    };
  }
}

// Export singleton instance
let merchantServiceInstance: MerchantService | null = null;

export const getMerchantService = (): MerchantService => {
  if (!merchantServiceInstance) {
    merchantServiceInstance = new MerchantService();
  }
  return merchantServiceInstance;
};
