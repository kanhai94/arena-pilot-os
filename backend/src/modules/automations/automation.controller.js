import { apiSuccess } from '../../utils/apiResponse.js';
import { parseOrThrow } from '../../validators/notification.validators.js';
import {
  automationPreviewFeeSchema,
  automationPreviewAbsenceSchema,
  automationPreviewBroadcastSchema,
  automationSendSchema,
  automationLogsQuerySchema
} from './automation.validators.js';

export const createAutomationController = (service) => {
  return {
    previewFeeReminder: async (req, res, next) => {
      try {
        const payload = parseOrThrow(automationPreviewFeeSchema, req.body);
        const data = await service.previewFeeReminder(payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    previewAbsenceAlert: async (req, res, next) => {
      try {
        const payload = parseOrThrow(automationPreviewAbsenceSchema, req.body);
        const data = await service.previewAbsenceAlert(payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    previewBroadcast: async (req, res, next) => {
      try {
        const payload = parseOrThrow(automationPreviewBroadcastSchema, req.body);
        const data = await service.previewBroadcast(payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    sendAutomation: async (req, res, next) => {
      try {
        const payload = parseOrThrow(automationSendSchema, req.body);
        const data = await service.sendAutomation(payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    getAutomationLogs: async (req, res, next) => {
      try {
        const query = parseOrThrow(automationLogsQuerySchema, req.query);
        const data = await service.getAutomationLogs(query.page, query.limit);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
