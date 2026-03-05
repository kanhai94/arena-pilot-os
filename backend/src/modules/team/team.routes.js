import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.middleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { authorizeRoles } from '../../middleware/authorizeRoles.js';
import { ROLES } from '../../constants/roles.js';
import { teamRepository } from './team.repository.js';
import { createTeamService } from './team.service.js';
import { createTeamController } from './team.controller.js';

const teamRouter = Router();

const teamService = createTeamService(teamRepository);
const teamController = createTeamController(teamService);

teamRouter.use(authMiddleware, tenantMiddleware, tenantContextMiddleware, tenantAccessGuard);

teamRouter.post('/', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), teamController.createTeamMember);
teamRouter.get('/', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH), teamController.listTeamMembers);
teamRouter.patch(
  '/:userId/access',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF, ROLES.COACH),
  teamController.updateTeamMemberAccess
);
teamRouter.patch(
  '/:userId/deactivate',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  teamController.deactivateTeamMember
);
teamRouter.delete(
  '/:userId',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  teamController.deleteTeamMember
);

export { teamRouter };
