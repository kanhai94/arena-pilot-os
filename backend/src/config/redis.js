import IORedis from 'ioredis';
import { env } from './env.js';

let sharedRedisClient = null;

export const createRedisConnection = () => {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false
  });
};

export const getRedisClient = () => {
  if (!sharedRedisClient) {
    sharedRedisClient = createRedisConnection();
  }
  return sharedRedisClient;
};

export const getRedisStatus = async () => {
  try {
    const redis = getRedisClient();
    const pingResponse = await redis.ping();
    return pingResponse === 'PONG' ? 'up' : 'down';
  } catch {
    return 'down';
  }
};
