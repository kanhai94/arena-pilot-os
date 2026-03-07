import { Router } from 'express';
import { createAuthController } from './auth.controller.js';
import { createAuthService } from './auth.service.js';
import { authRepository } from './auth.repository.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { ROLES } from '../../constants/roles.js';
import { tenantMetricsService } from '../tenantMetrics/tenantMetrics.container.js';

const authRouter = Router();

const authService = createAuthService(authRepository, { tenantMetricsService });
const authController = createAuthController(authService);

authRouter.post('/create-registration-order', authController.createRegistrationOrder);
authRouter.get('/registration-plans', authController.getRegistrationPlans);
authRouter.post('/request-signup-otp', authController.requestSignupOtp);
authRouter.post('/verify-signup-otp', authController.verifySignupOtp);
authRouter.post('/request-forgot-password-otp', authController.requestForgotPasswordOtp);
authRouter.post('/reset-password-with-otp', authController.resetPasswordWithOtp);

authRouter.post('/register-tenant', authController.registerTenant);
authRouter.post('/login', authController.login);
authRouter.post('/refresh-token', authController.refreshToken);
authRouter.post('/logout', authController.logout);

authRouter.get('/me', authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard, authController.getMe);
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
  tenantContextMiddleware,
  tenantAccessGuard,
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.COACH),
  authController.protectedTenantEcho
);

export { authRouter };
