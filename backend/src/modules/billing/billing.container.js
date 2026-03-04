import { billingRepository } from './billing.repository.js';
import { createBillingService } from './billing.service.js';
import { tenantMetricsService } from '../tenantMetrics/tenantMetrics.container.js';

export const billingService = createBillingService(billingRepository, { tenantMetricsService });
