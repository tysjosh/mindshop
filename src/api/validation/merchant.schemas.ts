import { z } from 'zod';

/**
 * Zod validation schemas for Merchant API endpoints
 * These schemas provide type-safe validation for all merchant-related requests
 */

// Common reusable schemas
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(5, 'Email must be at least 5 characters')
  .max(255, 'Email must not exceed 255 characters')
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  );

export const merchantIdSchema = z
  .string()
  .min(3, 'Merchant ID must be at least 3 characters')
  .max(100, 'Merchant ID must not exceed 100 characters')
  .regex(
    /^[a-z0-9_]+$/,
    'Merchant ID must contain only lowercase letters, numbers, and underscores'
  );

export const companyNameSchema = z
  .string()
  .min(2, 'Company name must be at least 2 characters')
  .max(255, 'Company name must not exceed 255 characters')
  .trim();

export const websiteSchema = z
  .string()
  .url('Invalid website URL')
  .max(255, 'Website URL must not exceed 255 characters')
  .optional()
  .or(z.literal(''));

export const industrySchema = z
  .string()
  .min(2, 'Industry must be at least 2 characters')
  .max(100, 'Industry must not exceed 100 characters')
  .optional();

export const confirmationCodeSchema = z
  .string()
  .min(6, 'Confirmation code must be at least 6 characters')
  .max(10, 'Confirmation code must not exceed 10 characters')
  .trim();

// POST /api/merchants/register
export const registerMerchantSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    companyName: companyNameSchema,
    website: websiteSchema,
    industry: industrySchema,
  }),
});

export type RegisterMerchantInput = z.infer<typeof registerMerchantSchema>['body'];

// POST /api/merchants/verify-email
export const verifyEmailSchema = z.object({
  body: z.object({
    email: emailSchema,
    confirmationCode: confirmationCodeSchema,
  }),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>['body'];

// POST /api/merchants/resend-verification
export const resendVerificationSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>['body'];

// POST /api/merchants/login
export const loginMerchantSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),
});

export type LoginMerchantInput = z.infer<typeof loginMerchantSchema>['body'];

// POST /api/merchants/refresh-token
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];

// POST /api/merchants/logout
export const logoutSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1, 'Access token is required'),
    sessionId: z.string().optional(),
  }),
});

export type LogoutInput = z.infer<typeof logoutSchema>['body'];

// POST /api/merchants/forgot-password
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];

// POST /api/merchants/reset-password
export const resetPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
    confirmationCode: confirmationCodeSchema,
    newPassword: passwordSchema,
  }),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];

// GET /api/merchants/:merchantId/profile
export const getMerchantProfileSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
});

export type GetMerchantProfileParams = z.infer<typeof getMerchantProfileSchema>['params'];

// PUT /api/merchants/:merchantId/profile
export const updateMerchantProfileSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  body: z.object({
    companyName: companyNameSchema.optional(),
    website: websiteSchema,
    industry: industrySchema,
  }),
});

export type UpdateMerchantProfileParams = z.infer<typeof updateMerchantProfileSchema>['params'];
export type UpdateMerchantProfileInput = z.infer<typeof updateMerchantProfileSchema>['body'];

// GET /api/merchants/:merchantId/settings
export const getMerchantSettingsSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
});

export type GetMerchantSettingsParams = z.infer<typeof getMerchantSettingsSchema>['params'];

// PUT /api/merchants/:merchantId/settings
export const updateMerchantSettingsSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  body: z.object({
    settings: z.record(z.string(), z.any()).refine(
      (val) => typeof val === 'object' && val !== null,
      { message: 'Settings must be a valid object' }
    ),
    partial: z.boolean().optional().default(true),
  }),
});

export type UpdateMerchantSettingsParams = z.infer<typeof updateMerchantSettingsSchema>['params'];
export type UpdateMerchantSettingsInput = z.infer<typeof updateMerchantSettingsSchema>['body'];

// DELETE /api/merchants/:merchantId/account
export const deleteMerchantAccountSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
});

export type DeleteMerchantAccountParams = z.infer<typeof deleteMerchantAccountSchema>['params'];

// Export all schemas as a collection for easy access
export const merchantSchemas = {
  register: registerMerchantSchema,
  verifyEmail: verifyEmailSchema,
  resendVerification: resendVerificationSchema,
  login: loginMerchantSchema,
  refreshToken: refreshTokenSchema,
  logout: logoutSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
  getProfile: getMerchantProfileSchema,
  updateProfile: updateMerchantProfileSchema,
  getSettings: getMerchantSettingsSchema,
  updateSettings: updateMerchantSettingsSchema,
  deleteAccount: deleteMerchantAccountSchema,
};
