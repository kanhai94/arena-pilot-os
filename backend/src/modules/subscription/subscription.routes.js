import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { ROLES } from '../../constants/roles.js';
import { billingService } from '../billing/billing.container.js';
import { createSubscriptionService } from './subscription.service.js';
import { createSubscriptionController } from './subscription.controller.js';

const subscriptionRouter = Router();

const subscriptionService = createSubscriptionService({ billingService });
const subscriptionController = createSubscriptionController(subscriptionService);

subscriptionRouter.use(authMiddleware, tenantMiddleware, tenantAccessGuard);

subscriptionRouter.get(
  '/current',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.COACH),
  subscriptionController.getCurrent
);

export { subscriptionRouter };
