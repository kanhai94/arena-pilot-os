import { Worker } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { NOTIFICATION_QUEUE_NAME } from '../queues/notification.queue.js';
import { notificationService } from '../modules/notifications/notification.container.js';
import { queueLogger } from '../config/logger.js';

const worker = new Worker(
  NOTIFICATION_QUEUE_NAME,
  async (job) => {
    await notificationService.processQueuedNotification(job.data.notificationId, job.data.tenantId || null);
  },
  {
    connection: createRedisConnection(),
    concurrency: 10
  }
);

worker.on('ready', () => {
  queueLogger.info('Notification worker started');
});

worker.on('completed', (job) => {
  queueLogger.info({ jobId: job.id }, 'Notification job completed');
});

worker.on('failed', (job, error) => {
  queueLogger.error(
    {
      jobId: job?.id,
      tenantId: job?.data?.tenantId || null,
      reason: error?.message || 'unknown',
      err: error
    },
    'Notification job failed'
  );
});

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
