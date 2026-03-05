import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { subscriptionGuard } from '../../middleware/subscriptionGuard.js';
import { ROLES } from '../../constants/roles.js';
import { batchRepository } from './batch.repository.js';
import { createBatchService } from './batch.service.js';
import { createBatchController } from './batch.controller.js';

const batchRouter = Router();

const batchService = createBatchService(batchRepository);
const batchController = createBatchController(batchService);

batchRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard, subscriptionGuard());

batchRouter.post('/', roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.STAFF, ROLES.COACH), batchController.createBatch);
batchRouter.get('/', roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.STAFF, ROLES.COACH), batchController.getBatches);
batchRouter.put('/:batchId', roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.STAFF, ROLES.COACH), batchController.updateBatch);
batchRouter.patch(
  '/:batchId/deactivate',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  batchController.deactivateBatch
);

export { batchRouter };
