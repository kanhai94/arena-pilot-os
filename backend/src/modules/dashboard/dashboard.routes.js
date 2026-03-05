import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.js';
import { ROLES } from '../../constants/roles.js';
import { dashboardRepository } from './dashboard.repository.js';
import { createDashboardService } from './dashboard.service.js';
import { createDashboardController } from './dashboard.controller.js';

const dashboardRouter = Router();

const dashboardService = createDashboardService(dashboardRepository);
const dashboardController = createDashboardController(dashboardService);

dashboardRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard);

dashboardRouter.get(
  '/overview',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  dashboardController.getOverview
);

export { dashboardRouter };

