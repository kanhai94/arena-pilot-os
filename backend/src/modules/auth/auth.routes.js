import { Router } from 'express';
import { createAuthController } from './auth.controller.js';
import { createAuthService } from './auth.service.js';
import { authRepository } from './auth.repository.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { ROLES } from '../../constants/roles.js';

const authRouter = Router();

const authService = createAuthService(authRepository);
const authController = createAuthController(authService);

authRouter.post('/request-signup-otp', authController.requestSignupOtp);
authRouter.post('/verify-signup-otp', authController.verifySignupOtp);
authRouter.post('/request-forgot-password-otp', authController.requestForgotPasswordOtp);
authRouter.post('/reset-password-with-otp', authController.resetPasswordWithOtp);

authRouter.post('/register-tenant', authController.registerTenant);
authRouter.post('/login', authController.login);
authRouter.post('/refresh-token', authController.refreshToken);
authRouter.post('/logout', authController.logout);

authRouter.get('/me', authMiddleware, tenantMiddleware, authController.getMe);
authRouter.get(
  '/registration-stats',
  authMiddleware,
  roleMiddleware(ROLES.SUPER_ADMIN),
  authController.getRegistrationStats
);

authRouter.get(
  '/protected-example',
  authMiddleware,
  tenantMiddleware,
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.COACH),
  authController.protectedTenantEcho
);

export { authRouter };
