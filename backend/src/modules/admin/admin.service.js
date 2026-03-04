import { encryptSecret } from '../../utils/secretCipher.js';
import { getNotificationQueueStatus } from '../../queues/notification.queue.js';

const maskKey = (value) => {
  if (!value) {
    return null;
  }
  const visible = value.slice(-4);
  return `****${visible}`;
};

export const createAdminService = (repository) => {
  return {
    async getTenants(query) {
      const { page, limit } = query;
      const { items, total } = await repository.listTenantsWithStudentCount(query);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    },

    async getRazorpaySettings() {
      const settings = await repository.getPlatformSettings();
      const razorpay = settings?.payments?.razorpay;

      return {
        configured: Boolean(razorpay?.keyId && razorpay?.keySecretEnc),
        isActive: Boolean(razorpay?.isActive),
        keyIdMasked: maskKey(razorpay?.keyId),
        updatedAt: razorpay?.updatedAt || null
      };
    },

    async updateRazorpaySettings(payload, updatedBy) {
      await repository.upsertRazorpaySettings({
        keyId: payload.keyId.trim(),
        keySecretEnc: encryptSecret(payload.keySecret.trim()),
        isActive: payload.isActive,
        updatedBy
      });

      return this.getRazorpaySettings();
    },

    async getQueueStatus() {
      return getNotificationQueueStatus();
    }
  };
};
