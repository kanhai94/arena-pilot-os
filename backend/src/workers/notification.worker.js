import { Worker } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { NOTIFICATION_QUEUE_NAME } from '../queues/notification.queue.js';
import { notificationService } from '../modules/notifications/notification.container.js';
import { logger } from '../config/logger.js';

const worker = new Worker(
  NOTIFICATION_QUEUE_NAME,
  async (job) => {
    await notificationService.processQueuedNotification(job.data.notificationId);
  },
  {
    connection: createRedisConnection(),
    concurrency: 10
  }
);

worker.on('ready', () => {
  logger.info('Notification worker started');
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Notification job completed');
});

worker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, err: error }, 'Notification job failed');
});

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
