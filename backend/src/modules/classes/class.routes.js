import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { checkOrgType } from '../../middleware/checkOrgType.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.js';
import { ROLES } from '../../constants/roles.js';
import { classRepository } from './class.repository.js';
import { createClassService } from './class.service.js';
import { createClassController } from './class.controller.js';

const classRouter = Router();

const classService = createClassService(classRepository);
const classController = createClassController(classService);

classRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard, checkOrgType('SCHOOL'));

classRouter.post('/', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), classController.createClass);
classRouter.get('/', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), classController.listClasses);
classRouter.get('/:id', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), classController.getClassDetails);
classRouter.put('/:id', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), classController.updateClass);
classRouter.delete('/:id', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN), classController.deleteClass);
classRouter.put(
  '/:id/assign-teacher',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  classController.assignTeacher
);

export { classRouter };
