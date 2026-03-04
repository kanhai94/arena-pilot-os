import { Router } from 'express';
import { platformRepository } from './platform.repository.js';
import { createPlatformService } from './platform.service.js';
import { createPlatformController } from './platform.controller.js';

const platformRouter = Router();

const platformService = createPlatformService(platformRepository);
const platformController = createPlatformController(platformService);

platformRouter.get('/health', platformController.getPlatformHealth);

export { platformRouter };

