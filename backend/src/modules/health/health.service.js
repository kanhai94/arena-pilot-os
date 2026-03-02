export const createHealthService = (repository) => {
  return {
    async getHealth() {
      const [database, redis] = await Promise.all([
        repository.getDatabaseStatus(),
        repository.getRedisStatus()
      ]);

      const overallStatus = database === 'up' && redis === 'up' ? 'ok' : 'degraded';

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services: {
          database,
          redis
        }
      };
    }
  };
};
