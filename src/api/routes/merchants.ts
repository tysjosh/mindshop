import { Router } from 'express';
import { MerchantController } from '../controllers/MerchantController';
import { authenticateJWT } from '../middleware/auth';
import { validateZodSchema } from '../middleware/zodValidation';
import {
  registerMerchantSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginMerchantSchema,
  refreshTokenSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  getMerchantProfileSchema,
  updateMerchantProfileSchema,
  getMerchantSettingsSchema,
  updateMerchantSettingsSchema,
  deleteMerchantAccountSchema,
} from '../validation/merchant.schemas';

const router = Router();
const merchantController = new MerchantController();

// Public routes (no authentication required)
router.post(
  '/register',
  validateZodSchema(registerMerchantSchema),
  merchantController.register.bind(merchantController)
);

router.post(
  '/verify-email',
  validateZodSchema(verifyEmailSchema),
  merchantController.verifyEmail.bind(merchantController)
);

router.post(
  '/resend-verification',
  validateZodSchema(resendVerificationSchema),
  merchantController.resendVerification.bind(merchantController)
);

router.post(
  '/login',
  validateZodSchema(loginMerchantSchema),
  merchantController.login.bind(merchantController)
);

router.post(
  '/refresh-token',
  validateZodSchema(refreshTokenSchema),
  merchantController.refreshToken.bind(merchantController)
);

router.post(
  '/logout',
  validateZodSchema(logoutSchema),
  merchantController.logout.bind(merchantController)
);

router.post(
  '/forgot-password',
  validateZodSchema(forgotPasswordSchema),
  merchantController.forgotPassword.bind(merchantController)
);

router.post(
  '/reset-password',
  validateZodSchema(resetPasswordSchema),
  merchantController.resetPassword.bind(merchantController)
);

// Protected routes (require JWT authentication)
router.get(
  '/:merchantId/profile',
  authenticateJWT(),
  validateZodSchema(getMerchantProfileSchema),
  merchantController.getProfile.bind(merchantController)
);

router.put(
  '/:merchantId/profile',
  authenticateJWT(),
  validateZodSchema(updateMerchantProfileSchema),
  merchantController.updateProfile.bind(merchantController)
);

router.get(
  '/:merchantId/settings',
  authenticateJWT(),
  validateZodSchema(getMerchantSettingsSchema),
  merchantController.getSettings.bind(merchantController)
);

router.put(
  '/:merchantId/settings',
  authenticateJWT(),
  validateZodSchema(updateMerchantSettingsSchema),
  merchantController.updateSettings.bind(merchantController)
);

router.delete(
  '/:merchantId/account',
  authenticateJWT(),
  validateZodSchema(deleteMerchantAccountSchema),
  merchantController.deleteAccount.bind(merchantController)
);

export default router;
