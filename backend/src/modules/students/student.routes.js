import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { subscriptionGuard } from '../../middleware/subscriptionGuard.js';
import { checkPlanLimit } from '../../middleware/checkPlanLimit.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { ROLES } from '../../constants/roles.js';
import { billingService } from '../billing/billing.container.js';
import { tenantMetricsService } from '../tenantMetrics/tenantMetrics.container.js';
import { studentRepository } from './student.repository.js';
import { createStudentService } from './student.service.js';
import { createStudentController } from './student.controller.js';

const studentRouter = Router();

const studentService = createStudentService(studentRepository, { billingService, tenantMetricsService });
const studentController = createStudentController(studentService);

studentRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard, subscriptionGuard());

studentRouter.post(
  '/',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  checkPlanLimit('student'),
  studentController.createStudent
);

studentRouter.get(
  '/',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.COACH),
  studentController.listStudents
);

studentRouter.get(
  '/:studentId',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.COACH),
  studentController.getStudentById
);

studentRouter.put(
  '/:studentId',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  studentController.updateStudent
);

studentRouter.patch(
  '/:studentId/deactivate',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  studentController.deactivateStudent
);

export { studentRouter };
