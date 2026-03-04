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
    removeOnFail: false
  }
});

export const enqueueNotificationJob = async (notificationId, tenantId = null) => {
  return notificationQueue.add(
    'send-notification',
    { notificationId, tenantId },
    {
      jobId: `notification:${notificationId}`
    }
  );
};

export const getNotificationQueueStatus = async () => {
  const counts = await notificationQueue.getJobCounts('waiting', 'active', 'failed', 'completed');
  return {
    waitingJobs: counts.waiting || 0,
    activeJobs: counts.active || 0,
    failedJobs: counts.failed || 0,
    completedJobs: counts.completed || 0
  };
};

export const getNotificationQueueRuntimeStatus = async () => {
  try {
    const workers = await notificationQueue.getWorkersCount();
    return workers > 0 ? 'running' : 'stopped';
  } catch {
    return 'stopped';
  }
};
