import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { ROLES } from '../../constants/roles.js';
import { billingService } from './billing.container.js';
import { createBillingController } from './billing.controller.js';

const billingRouter = Router();
const billingController = createBillingController(billingService);

billingRouter.use(authMiddleware, tenantMiddleware);

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
