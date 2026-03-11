import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import {
  createPlanSchema,
  createTenantOrderSchema,
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

    createTenantOrder: async (req, res, next) => {
      try {
        const payload = parseOrThrow(createTenantOrderSchema, req.body);
        const data = await service.createTenantOrder(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    subscribeTenant: async (req, res, next) => {
      try {
        const payload = parseOrThrow(subscribeTenantSchema, req.body);
        const data = await service.subscribeTenant(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    upgradePlan: async (req, res, next) => {
      try {
        const payload = parseOrThrow(upgradePlanSchema, req.body);
        const data = await service.upgradePlan(payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    cancelSubscription: async (req, res, next) => {
      try {
        const data = await service.cancelSubscription();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    getCurrentSubscription: async (req, res, next) => {
      try {
        const data = await service.getCurrentSubscription();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
