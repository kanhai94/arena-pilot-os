import { apiSuccess } from '../../utils/apiResponse.js';
import {
  notificationLogsQuerySchema,
  parseOrThrow,
  sendBroadcastSchema,
  triggerFeeReminderSchema
} from '../../validators/notification.validators.js';

export const createNotificationController = (service) => {
  return {
    triggerFeeReminder: async (req, res, next) => {
      try {
        const payload = parseOrThrow(triggerFeeReminderSchema, req.body);
        const data = await service.triggerFeeReminderEvent(req.tenantId, payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    sendBroadcastMessage: async (req, res, next) => {
      try {
        const payload = parseOrThrow(sendBroadcastSchema, req.body);
        const data = await service.sendBroadcastEvent(req.tenantId, payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    getNotificationLogs: async (req, res, next) => {
      try {
        const query = parseOrThrow(notificationLogsQuerySchema, req.query);
        const data = await service.getNotificationLogs(req.tenantId, query);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
