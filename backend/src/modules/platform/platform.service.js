export const createPlatformService = (repository) => {
  return {
    async getPlatformHealth() {
      let dbRaw = 'down';
      let redisRaw = 'down';
      let queueStatus = 'stopped';
      let totalTenants = 0;
      let activeTenants = 0;

      try {
        [dbRaw, redisRaw, queueStatus, totalTenants, activeTenants] = await Promise.all([
          repository.getMongoStatus(),
          repository.getRedisStatus(),
          repository.getQueueRuntimeStatus(),
          repository.countTotalTenants(),
          repository.countActiveTenants()
        ]);
      } catch {
        // graceful fallback with defaults
      }

      const dbStatus = dbRaw === 'up' ? 'connected' : 'disconnected';
      const redisStatus = redisRaw === 'up' ? 'connected' : 'disconnected';

      return {
        dbStatus,
        redisStatus,
        queueStatus,
        totalTenants,
        activeTenants,
        memoryUsage: process.memoryUsage(),
        uptime: Number(process.uptime().toFixed(2))
      };
    }
  };
};

