import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { ROLES } from '../../constants/roles.js';
import { billingService } from './billing.container.js';
import { createBillingController } from './billing.controller.js';

const billingRouter = Router();
const billingController = createBillingController(billingService);

billingRouter.post('/webhooks/razorpay', billingController.razorpayWebhook);

billingRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware);

billingRouter.post('/plans', roleMiddleware(ROLES.SUPER_ADMIN), billingController.createPlan);
billingRouter.post(
  '/subscribe',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  billingController.subscribeTenant
);
billingRouter.post(
  '/upgrade',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  billingController.upgradePlan
);
billingRouter.post(
  '/cancel',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  billingController.cancelSubscription
);
billingRouter.get(
  '/current',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.COACH),
  billingController.getCurrentSubscription
);

export { billingRouter };
