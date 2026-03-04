import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import {
  adminTenantIdParamsSchema,
  createOrUpdateTenantSchema,
  parseOrThrow,
  superAdminTenantsQuerySchema,
  updateTenantPriceOverrideSchema,
  updateTenantStatusSchema,
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
    },

    createTenant: async (req, res, next) => {
      try {
        const payload = parseOrThrow(createOrUpdateTenantSchema, req.body);
        const data = await service.createTenant(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    updateTenant: async (req, res, next) => {
      try {
        const { id } = parseOrThrow(adminTenantIdParamsSchema, req.params);
        const payload = parseOrThrow(createOrUpdateTenantSchema, req.body);
        const data = await service.updateTenant(id, payload);
        return apiSuccess(res, data, StatusCodes.OK);
      } catch (error) {
        return next(error);
      }
    },

    updateTenantStatus: async (req, res, next) => {
      try {
        const { id } = parseOrThrow(adminTenantIdParamsSchema, req.params);
        const payload = parseOrThrow(updateTenantStatusSchema, req.body);
        const data = await service.updateTenantStatus(id, payload.tenantStatus);
        return apiSuccess(res, data, StatusCodes.OK);
      } catch (error) {
        return next(error);
      }
    },

    resetTenantAccess: async (req, res, next) => {
      try {
        const { id } = parseOrThrow(adminTenantIdParamsSchema, req.params);
        const data = await service.resetTenantAccess(id);
        return apiSuccess(res, data, StatusCodes.OK);
      } catch (error) {
        return next(error);
      }
    },

    updateTenantPriceOverride: async (req, res, next) => {
      try {
        const { id } = parseOrThrow(adminTenantIdParamsSchema, req.params);
        const payload = parseOrThrow(updateTenantPriceOverrideSchema, req.body);
        const data = await service.updateTenantPriceOverride(id, payload.customPriceOverride);
        return apiSuccess(res, data, StatusCodes.OK);
      } catch (error) {
        return next(error);
      }
    }
  };
};
