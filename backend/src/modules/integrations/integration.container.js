import { integrationRepository } from './integration.repository.js';
import { createIntegrationService } from './integration.service.js';
import { notificationService } from '../notifications/notification.container.js';

export const integrationService = createIntegrationService(integrationRepository, { notificationService });
