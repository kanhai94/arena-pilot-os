import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { ROLES } from '../../constants/roles.js';
import { billingService } from '../billing/billing.container.js';
import { billingRepository } from '../billing/billing.repository.js';
import { tenantRepository } from './tenant.repository.js';
import { createTenantService } from './tenant.service.js';
import { createTenantController } from './tenant.controller.js';

const tenantRouter = Router();

const tenantService = createTenantService({ billingService, billingRepository, tenantRepository });
const tenantController = createTenantController(tenantService);

tenantRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard);

tenantRouter.get(
  '/features',
  tenantController.getFeatures
);

tenantRouter.get(
  '/subscription',
  roleMiddleware(ROLES.ADMIN),
  tenantController.getSubscription
);

tenantRouter.get(
  '/plans',
  roleMiddleware(ROLES.ADMIN),
  tenantController.getPlans
);

tenantRouter.post(
  '/upgrade-plan',
  roleMiddleware(ROLES.ADMIN),
  tenantController.upgradePlan
);

tenantRouter.get(
  '/payments',
  roleMiddleware(ROLES.ADMIN),
  tenantController.getPayments
);

export { tenantRouter };
