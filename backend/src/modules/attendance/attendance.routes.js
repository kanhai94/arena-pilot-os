import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.js';
import { subscriptionGuard } from '../../middleware/subscriptionGuard.js';
import { ROLES } from '../../constants/roles.js';
import { tenantMetricsService } from '../tenantMetrics/tenantMetrics.container.js';
import { attendanceRepository } from './attendance.repository.js';
import { createAttendanceService } from './attendance.service.js';
import { createAttendanceController } from './attendance.controller.js';

const attendanceRouter = Router();

const attendanceService = createAttendanceService(attendanceRepository, { tenantMetricsService });
const attendanceController = createAttendanceController(attendanceService);

attendanceRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard, subscriptionGuard());

attendanceRouter.post(
  '/mark',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  attendanceController.markAttendance
);
attendanceRouter.get(
  '/by-date',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  attendanceController.getAttendanceByDate
);
attendanceRouter.get(
  '/student-stats',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  attendanceController.getStudentAttendanceStats
);

export { attendanceRouter };
