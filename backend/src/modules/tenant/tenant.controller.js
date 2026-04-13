import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import { parseOrThrow } from '../../validators/billing.validators.js';
import { z } from 'zod';

const upgradeTenantPlanSchema = z
  .object({
    planId: z.string().min(1),
    autoRenew: z.boolean().optional(),
    payment: z
      .object({
        razorpayOrderId: z.string().min(1),
        razorpayPaymentId: z.string().min(1),
        razorpaySignature: z.string().min(1)
      })
      .strict()
      .optional()
  })
  .strict();

export const createTenantController = (service) => {
  return {
    getSubscription: async (_req, res, next) => {
      try {
        const data = await service.getSubscription();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    getFeatures: async (_req, res, next) => {
      try {
        const data = await service.getFeatures();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    getPlans: async (_req, res, next) => {
      try {
        const data = await service.getPlans();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    upgradePlan: async (req, res, next) => {
      try {
        const payload = parseOrThrow(upgradeTenantPlanSchema, req.body);
        const data = await service.upgradePlan(payload.planId, payload.payment ?? null, payload.autoRenew ?? true);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    getPayments: async (_req, res, next) => {
      try {
        const data = await service.getPayments();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
