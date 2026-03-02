import { apiSuccess } from '../../utils/apiResponse.js';

export const createHealthController = (healthService) => {
  return {
    getHealth: async (req, res, next) => {
      try {
        const data = await healthService.getHealth();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
