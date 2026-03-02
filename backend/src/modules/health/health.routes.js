import { Router } from 'express';
import { createHealthController } from './health.controller.js';
import { healthRepository } from './health.repository.js';
import { createHealthService } from './health.service.js';

const healthRouter = Router();

const healthService = createHealthService(healthRepository);
const healthController = createHealthController(healthService);

healthRouter.get('/', healthController.getHealth);

export { healthRouter };
