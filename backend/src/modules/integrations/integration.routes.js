import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.js';
import { ROLES } from '../../constants/roles.js';
import { integrationRepository } from './integration.repository.js';
import { createIntegrationService } from './integration.service.js';
import { createIntegrationController } from './integration.controller.js';
import { notificationService } from '../notifications/notification.container.js';

const integrationRouter = Router();

const integrationService = createIntegrationService(integrationRepository, { notificationService });
const integrationController = createIntegrationController(integrationService);

integrationRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard);

integrationRouter.get('/', authorizeRoles(ROLES.ADMIN), integrationController.getTenantIntegrations);
integrationRouter.put('/', authorizeRoles(ROLES.ADMIN), integrationController.updateTenantIntegrations);

export { integrationRouter };
