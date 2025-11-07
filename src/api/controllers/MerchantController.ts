import { Request, Response } from 'express';
import { getMerchantService } from '../../services/MerchantService';
import { ApiResponse } from '../../types';
import { AuthenticatedRequest } from '../middleware/auth';

export class MerchantController {
  private merchantService = getMerchantService();

  /**
   * Register a new merchant
   * POST /api/merchants/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, companyName, website, industry } = req.body;

      // Validate required fields
      if (!email || !password || !companyName) {
        const response: ApiResponse = {
          success: false,
          error: 'Email, password, and company name are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid email format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate password strength (minimum 8 characters, at least one uppercase, one lowercase, one number)
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password)) {
        const response: ApiResponse = {
          success: false,
          error: 'Password must be at least 8 characters and contain uppercase, lowercase, and numbers',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.merchantService.register({
        email,
        password,
        companyName,
        website,
        industry,
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(201).json(response);
    } catch (error: any) {
      console.error('Register error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Registration failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Verify email with confirmation code
   * POST /api/merchants/verify-email
   */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email, confirmationCode } = req.body;

      // Validate required fields
      if (!email || !confirmationCode) {
        const response: ApiResponse = {
          success: false,
          error: 'Email and confirmation code are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.merchantService.verifyEmail({
        email,
        confirmationCode,
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Verify email error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Email verification failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Resend verification code
   * POST /api/merchants/resend-verification
   */
  async resendVerification(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      // Validate required fields
      if (!email) {
        const response: ApiResponse = {
          success: false,
          error: 'Email is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.merchantService.resendVerificationCode(email);

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Resend verification error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to resend verification code',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Login merchant
   * POST /api/merchants/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        const response: ApiResponse = {
          success: false,
          error: 'Email and password are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.merchantService.login({
        email,
        password,
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Login error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Login failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(401).json(response);
    }
  }

  /**
   * Refresh access token
   * POST /api/merchants/refresh-token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      // Validate required fields
      if (!refreshToken) {
        const response: ApiResponse = {
          success: false,
          error: 'Refresh token is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.merchantService.refreshToken({
        refreshToken,
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Refresh token error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Token refresh failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(401).json(response);
    }
  }

  /**
   * Logout merchant
   * POST /api/merchants/logout
   * Requirement 7.4: Logout functionality
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { accessToken, sessionId } = req.body;

      // Validate required fields
      if (!accessToken) {
        const response: ApiResponse = {
          success: false,
          error: 'Access token is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.merchantService.logout({
        accessToken,
        sessionId,
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Logout error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Logout failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Initiate forgot password flow
   * POST /api/merchants/forgot-password
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      // Validate required fields
      if (!email) {
        const response: ApiResponse = {
          success: false,
          error: 'Email is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.merchantService.forgotPassword({
        email,
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to initiate password reset',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Reset password with confirmation code
   * POST /api/merchants/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, confirmationCode, newPassword } = req.body;

      // Validate required fields
      if (!email || !confirmationCode || !newPassword) {
        const response: ApiResponse = {
          success: false,
          error: 'Email, confirmation code, and new password are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        const response: ApiResponse = {
          success: false,
          error: 'Password must be at least 8 characters and contain uppercase, lowercase, and numbers',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.merchantService.resetPassword({
        email,
        confirmationCode,
        newPassword,
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Reset password error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Password reset failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Get merchant profile
   * GET /api/merchants/:merchantId/profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      const result = await this.merchantService.getProfile(merchantId);

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get profile error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get profile',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Update merchant profile
   * PUT /api/merchants/:merchantId/profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { companyName, website, industry } = req.body;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      const result = await this.merchantService.updateProfile(merchantId, {
        companyName,
        website,
        industry,
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Update profile error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to update profile',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Get merchant settings
   * GET /api/merchants/:merchantId/settings
   */
  async getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      const result = await this.merchantService.getSettings(merchantId);

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get settings error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get settings',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Update merchant settings
   * PUT /api/merchants/:merchantId/settings
   */
  async updateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { settings, partial = true } = req.body;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate settings object
      if (!settings || typeof settings !== 'object') {
        const response: ApiResponse = {
          success: false,
          error: 'Settings object is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.merchantService.updateSettings(merchantId, settings, partial);

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Update settings error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to update settings',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Delete merchant account
   * DELETE /api/merchants/:merchantId/account
   */
  async deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      const result = await this.merchantService.deleteAccount(merchantId);

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Delete account error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to delete account',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }
}
