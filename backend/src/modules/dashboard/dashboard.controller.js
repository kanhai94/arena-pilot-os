import { apiSuccess } from '../../utils/apiResponse.js';

export const createDashboardController = (service) => {
  return {
    getOverview: async (_req, res, next) => {
      try {
        const data = await service.getOverview();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};

