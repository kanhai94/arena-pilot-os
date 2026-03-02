import { apiSuccess } from '../../utils/apiResponse.js';

export const createSubscriptionController = (service) => {
  return {
    getCurrent: async (req, res, next) => {
      try {
        const data = await service.getCurrent(req.tenantId);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
