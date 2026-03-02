import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { tenantMiddleware } from '../../middleware/tenantMiddleware.js';
import { tenantAccessGuard } from '../../middleware/tenantAccessGuard.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { ROLES } from '../../constants/roles.js';
import { teamRepository } from './team.repository.js';
import { createTeamService } from './team.service.js';
import { createTeamController } from './team.controller.js';

const teamRouter = Router();

const teamService = createTeamService(teamRepository);
const teamController = createTeamController(teamService);

teamRouter.use(authMiddleware, tenantMiddleware, tenantAccessGuard);

teamRouter.post('/', roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN), teamController.createTeamMember);
teamRouter.get('/', roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN), teamController.listTeamMembers);
teamRouter.patch(
  '/:userId/access',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  teamController.updateTeamMemberAccess
);
teamRouter.patch(
  '/:userId/deactivate',
  roleMiddleware(ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN),
  teamController.deactivateTeamMember
);

export { teamRouter };
