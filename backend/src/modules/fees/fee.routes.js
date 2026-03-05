import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.js';
import { subscriptionGuard } from '../../middleware/subscriptionGuard.js';
import { ROLES } from '../../constants/roles.js';
import { tenantMetricsService } from '../tenantMetrics/tenantMetrics.container.js';
import { feeRepository } from './fee.repository.js';
import { createFeeService } from './fee.service.js';
import { createFeeController } from './fee.controller.js';

const feeRouter = Router();

const feeService = createFeeService(feeRepository, { tenantMetricsService });
const feeController = createFeeController(feeService);

feeRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard, subscriptionGuard());

feeRouter.post('/plans', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), feeController.createFeePlan);
feeRouter.get('/plans', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), feeController.getFeePlans);
feeRouter.patch('/plans/:planId', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), feeController.updateFeePlan);

feeRouter.post(
  '/student-fees/assign',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  feeController.assignFeePlan
);
feeRouter.get(
  '/student-fees/status',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  feeController.getStudentFeeStatus
);

feeRouter.post('/payments', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN), feeController.recordPayment);
feeRouter.get(
  '/payments/history',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  feeController.paymentHistory
);
feeRouter.get(
  '/payments/pending',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  feeController.pendingFeesList
);

export { feeRouter };
