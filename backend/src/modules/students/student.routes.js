import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.js';
import { subscriptionGuard } from '../../middleware/subscriptionGuard.js';
import { checkPlanLimit } from '../../middleware/checkPlanLimit.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { checkOrgType } from '../../middleware/checkOrgType.js';
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
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  checkPlanLimit('student'),
  studentController.createStudent
);

studentRouter.get(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COACH, ROLES.STAFF),
  studentController.listStudents
);

studentRouter.get(
  '/:studentId',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COACH, ROLES.STAFF),
  studentController.getStudentById
);

studentRouter.put(
  '/:studentId',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  studentController.updateStudent
);

studentRouter.put(
  '/:studentId/assign-class',
  checkOrgType('SCHOOL'),
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  studentController.assignClass
);

studentRouter.patch(
  '/:studentId/deactivate',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  studentController.deactivateStudent
);

studentRouter.delete(
  '/:studentId',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  studentController.deleteStudent
);

export { studentRouter };
