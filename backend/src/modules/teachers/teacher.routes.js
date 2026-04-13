import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { checkOrgType } from '../../middleware/checkOrgType.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.js';
import { ROLES } from '../../constants/roles.js';
import { teacherRepository } from './teacher.repository.js';
import { createTeacherService } from './teacher.service.js';
import { createTeacherController } from './teacher.controller.js';

const teacherRouter = Router();

const teacherService = createTeacherService(teacherRepository);
const teacherController = createTeacherController(teacherService);

teacherRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard, checkOrgType('SCHOOL'));

teacherRouter.post('/', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), teacherController.createTeacher);
teacherRouter.get('/', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), teacherController.listTeachers);

export { teacherRouter };
