import { getDatabaseStatus } from '../../config/database.js';
import { getRedisStatus } from '../../config/redis.js';
import { getNotificationQueueRuntimeStatus } from '../../queues/notification.queue.js';
import { Tenant } from '../../models/tenant.model.js';

export const platformRepository = {
  async getMongoStatus() {
    return getDatabaseStatus();
  },

  async getRedisStatus() {
    return getRedisStatus();
  },

  async getQueueRuntimeStatus() {
    return getNotificationQueueRuntimeStatus();
  },

  countTotalTenants() {
    return Tenant.countDocuments({});
  },

  countActiveTenants() {
    return Tenant.countDocuments({ tenantStatus: 'active' });
  }
};

