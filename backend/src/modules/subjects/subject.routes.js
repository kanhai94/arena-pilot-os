import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { checkOrgType } from '../../middleware/checkOrgType.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.js';
import { ROLES } from '../../constants/roles.js';
import { subjectRepository } from './subject.repository.js';
import { createSubjectService } from './subject.service.js';
import { createSubjectController } from './subject.controller.js';

const subjectRouter = Router();

const subjectService = createSubjectService(subjectRepository);
const subjectController = createSubjectController(subjectService);

subjectRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard, checkOrgType('SCHOOL'));

subjectRouter.post('/', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), subjectController.createSubject);
subjectRouter.get('/', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), subjectController.listSubjects);
subjectRouter.put('/:id', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), subjectController.updateSubject);
subjectRouter.delete('/:id', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), subjectController.deleteSubject);

export { subjectRouter };
