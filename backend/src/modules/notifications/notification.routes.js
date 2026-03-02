import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { subscriptionGuard } from '../../middleware/subscriptionGuard.js';
import { ROLES } from '../../constants/roles.js';
import { notificationService } from './notification.container.js';
import { createNotificationController } from './notification.controller.js';

const notificationRouter = Router();
const controller = createNotificationController(notificationService);

notificationRouter.use(authMiddleware, tenantMiddleware, subscriptionGuard());

notificationRouter.post(
  '/fee-reminder/trigger',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  controller.triggerFeeReminder
);
notificationRouter.post(
  '/broadcast/send',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  controller.sendBroadcastMessage
);
notificationRouter.get('/logs', roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN), controller.getNotificationLogs);

export { notificationRouter };
