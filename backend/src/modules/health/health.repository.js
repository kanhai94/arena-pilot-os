import { getDatabaseStatus } from '../../config/database.js';
import { getRedisStatus } from '../../config/redis.js';

export const healthRepository = {
  getDatabaseStatus,
  getRedisStatus
};
