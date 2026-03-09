import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { subscriptionGuard } from '../../middleware/subscriptionGuard.js';
import { ROLES } from '../../constants/roles.js';
import { createAutomationController } from './automation.controller.js';
import { createAutomationService } from './automation.service.js';
import { automationRepository } from './automation.repository.js';
import { notificationService } from '../notifications/notification.container.js';

const automationRouter = Router();
const service = createAutomationService({ repository: automationRepository, notificationService });
const controller = createAutomationController(service);

automationRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard, subscriptionGuard());

automationRouter.post(
  '/fee-reminder/preview',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  controller.previewFeeReminder
);

automationRouter.post(
  '/absence-alert/preview',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  controller.previewAbsenceAlert
);

automationRouter.post(
  '/broadcast/preview',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  controller.previewBroadcast
);

automationRouter.post(
  '/send',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  controller.sendAutomation
);

automationRouter.get(
  '/logs',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  controller.getAutomationLogs
);

export { automationRouter };
