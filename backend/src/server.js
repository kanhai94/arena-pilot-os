import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { getRedisStatus } from './config/redis.js';
import { logger } from './config/logger.js';
import { ensureSuperAdminBootstrap } from './bootstrap/superAdmin.bootstrap.js';
import { registerNotificationEventHandlers } from './modules/notifications/notification.events.js';

const startServer = async () => {
  try {
    await connectDatabase();

    await ensureSuperAdminBootstrap();

    const redisStatus = await getRedisStatus();
    if (redisStatus !== 'up') {
      logger.warn('Redis ping failed during startup; background jobs may be degraded');
    }

    registerNotificationEventHandlers();

    const app = createApp();

    app.listen(env.PORT, () => {
      logger.info(`Backend server running on port ${env.PORT}`);
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
