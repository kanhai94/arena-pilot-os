import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import {
  batchIdParamSchema,
  createBatchSchema,
  listBatchesQuerySchema,
  parseOrThrow,
  updateBatchSchema
} from '../../validators/batch.validators.js';

export const createBatchController = (batchService) => {
  return {
    createBatch: async (req, res, next) => {
      try {
        const payload = parseOrThrow(createBatchSchema, req.body);
        const data = await batchService.createBatch(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    getBatches: async (req, res, next) => {
      try {
        const query = parseOrThrow(listBatchesQuerySchema, req.query);
        const data = await batchService.listBatches(req.auth, query);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    updateBatch: async (req, res, next) => {
      try {
        const { batchId } = parseOrThrow(batchIdParamSchema, req.params);
        const payload = parseOrThrow(updateBatchSchema, req.body);
        const data = await batchService.updateBatch(batchId, payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    deactivateBatch: async (req, res, next) => {
      try {
        const { batchId } = parseOrThrow(batchIdParamSchema, req.params);
        const data = await batchService.deactivateBatch(batchId);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
