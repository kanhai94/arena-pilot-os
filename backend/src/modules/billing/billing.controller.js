import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import {
  createPlanSchema,
  parseOrThrow,
  subscribeTenantSchema,
  upgradePlanSchema
} from '../../validators/billing.validators.js';

export const createBillingController = (service) => {
  return {
    razorpayWebhook: async (req, res, next) => {
      try {
        const data = await service.processRazorpayWebhook({
          signature: req.headers['x-razorpay-signature'],
          rawBody: req.rawBody,
          payload: req.body
        });
        return apiSuccess(res, data, StatusCodes.OK);
      } catch (error) {
        return next(error);
      }
    },

    createPlan: async (req, res, next) => {
      try {
        const payload = parseOrThrow(createPlanSchema, req.body);
        const data = await service.createPlan(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    subscribeTenant: async (req, res, next) => {
      try {
        const payload = parseOrThrow(subscribeTenantSchema, req.body);
        const data = await service.subscribeTenant(req.tenantId, payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    upgradePlan: async (req, res, next) => {
      try {
        const payload = parseOrThrow(upgradePlanSchema, req.body);
        const data = await service.upgradePlan(req.tenantId, payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    cancelSubscription: async (req, res, next) => {
      try {
        const data = await service.cancelSubscription(req.tenantId);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    getCurrentSubscription: async (req, res, next) => {
      try {
        const data = await service.getCurrentSubscription(req.tenantId);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
