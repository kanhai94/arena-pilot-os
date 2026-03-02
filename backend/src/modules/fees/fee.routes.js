import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { subscriptionGuard } from '../../middleware/subscriptionGuard.js';
import { ROLES } from '../../constants/roles.js';
import { feeRepository } from './fee.repository.js';
import { createFeeService } from './fee.service.js';
import { createFeeController } from './fee.controller.js';

const feeRouter = Router();

const feeService = createFeeService(feeRepository);
const feeController = createFeeController(feeService);

feeRouter.use(authMiddleware, tenantMiddleware, tenantAccessGuard, subscriptionGuard());

feeRouter.post('/plans', roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN), feeController.createFeePlan);
feeRouter.get('/plans', roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN), feeController.getFeePlans);

feeRouter.post(
  '/student-fees/assign',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  feeController.assignFeePlan
);
feeRouter.get(
  '/student-fees/status',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.COACH),
  feeController.getStudentFeeStatus
);

feeRouter.post('/payments', roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN), feeController.recordPayment);
feeRouter.get(
  '/payments/history',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  feeController.paymentHistory
);
feeRouter.get(
  '/payments/pending',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  feeController.pendingFeesList
);

export { feeRouter };
