import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';

export const NOTIFICATION_QUEUE_NAME = 'notification-send-queue';

const queueConnection = createRedisConnection();

export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  }
});

export const enqueueNotificationJob = async (notificationId) => {
  return notificationQueue.add(
    'send-notification',
    { notificationId },
    {
      jobId: `notification:${notificationId}`
    }
  );
};
