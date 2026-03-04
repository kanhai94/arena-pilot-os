import { enqueueNotificationJob } from '../../queues/notification.queue.js';
import { mockWhatsAppAdapter } from '../../adapters/whatsapp.adapter.js';
import { tenantMetricsService } from '../tenantMetrics/tenantMetrics.container.js';
import { notificationRepository } from './notification.repository.js';
import { createNotificationService } from './notification.service.js';

export const notificationService = createNotificationService({
  repository: notificationRepository,
  enqueueJob: enqueueNotificationJob,
  whatsappAdapter: mockWhatsAppAdapter,
  tenantMetricsService
});
