import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import {
  assignFeePlanSchema,
  createFeePlanSchema,
  parseOrThrow,
  paymentHistoryQuerySchema,
  pendingFeesListQuerySchema,
  recordPaymentSchema,
  studentFeeStatusQuerySchema,
  updateFeePlanParamsSchema,
  updateFeePlanSchema
} from '../../validators/fee.validators.js';

export const createFeeController = (feeService) => {
  return {
    createFeePlan: async (req, res, next) => {
      try {
        const payload = parseOrThrow(createFeePlanSchema, req.body);
        const data = await feeService.createFeePlan(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    getFeePlans: async (req, res, next) => {
      try {
        const data = await feeService.getFeePlans();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    updateFeePlan: async (req, res, next) => {
      try {
        const params = parseOrThrow(updateFeePlanParamsSchema, req.params);
        const payload = parseOrThrow(updateFeePlanSchema, req.body);
        const data = await feeService.updateFeePlan(params.planId, payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    assignFeePlan: async (req, res, next) => {
      try {
        const payload = parseOrThrow(assignFeePlanSchema, req.body);
        const data = await feeService.assignFeePlan(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    getStudentFeeStatus: async (req, res, next) => {
      try {
        const query = parseOrThrow(studentFeeStatusQuerySchema, req.query);
        const data = await feeService.getStudentFeeStatus(query.studentId, query.asOfDate);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    recordPayment: async (req, res, next) => {
      try {
        const payload = parseOrThrow(recordPaymentSchema, req.body);
        const data = await feeService.recordPayment(req.auth.userId, payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    paymentHistory: async (req, res, next) => {
      try {
        const query = parseOrThrow(paymentHistoryQuerySchema, req.query);
        const data = await feeService.paymentHistory(query.studentId, query.page, query.limit);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    pendingFeesList: async (req, res, next) => {
      try {
        const query = parseOrThrow(pendingFeesListQuerySchema, req.query);
        const data = await feeService.pendingFeesList(query.page, query.limit, query.search, query.asOfDate);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
