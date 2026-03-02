import { billingRepository } from './billing.repository.js';
import { createBillingService } from './billing.service.js';

export const billingService = createBillingService(billingRepository);
