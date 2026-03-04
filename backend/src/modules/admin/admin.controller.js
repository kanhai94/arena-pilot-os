import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import {
  parseOrThrow,
  superAdminTenantsQuerySchema,
  updateRazorpaySettingsSchema
} from '../../validators/admin.validators.js';

export const createAdminController = (service) => {
  return {
    getTenants: async (req, res, next) => {
      try {
        const query = parseOrThrow(superAdminTenantsQuerySchema, req.query);
        const data = await service.getTenants(query);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    getRazorpaySettings: async (req, res, next) => {
      try {
        const data = await service.getRazorpaySettings();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    updateRazorpaySettings: async (req, res, next) => {
      try {
        const payload = parseOrThrow(updateRazorpaySettingsSchema, req.body);
        const data = await service.updateRazorpaySettings(payload, req.auth.userId);
        return apiSuccess(res, data, StatusCodes.OK);
      } catch (error) {
        return next(error);
      }
    },

    getQueueStatus: async (req, res, next) => {
      try {
        const data = await service.getQueueStatus();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
