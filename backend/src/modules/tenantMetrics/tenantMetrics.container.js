import { tenantMetricsRepository } from './tenantMetrics.repository.js';
import { createTenantMetricsService } from './tenantMetrics.service.js';

export const tenantMetricsService = createTenantMetricsService(tenantMetricsRepository);

