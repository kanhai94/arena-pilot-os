import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { subscriptionGuard } from '../../middleware/subscriptionGuard.js';
import { ROLES } from '../../constants/roles.js';
import { tenantMetricsService } from '../tenantMetrics/tenantMetrics.container.js';
import { attendanceRepository } from './attendance.repository.js';
import { createAttendanceService } from './attendance.service.js';
import { createAttendanceController } from './attendance.controller.js';

const attendanceRouter = Router();

const attendanceService = createAttendanceService(attendanceRepository, { tenantMetricsService });
const attendanceController = createAttendanceController(attendanceService);

attendanceRouter.use(authMiddleware, tenantMiddleware, tenantAccessGuard, subscriptionGuard());

attendanceRouter.post(
  '/mark',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.COACH),
  attendanceController.markAttendance
);
attendanceRouter.get(
  '/by-date',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.COACH),
  attendanceController.getAttendanceByDate
);
attendanceRouter.get(
  '/student-stats',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.COACH),
  attendanceController.getStudentAttendanceStats
);

export { attendanceRouter };
