import { apiSuccess } from '../../utils/apiResponse.js';

export const createPlatformController = (service) => {
  return {
    getPlatformHealth: async (_req, res, next) => {
      try {
        const data = await service.getPlatformHealth();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};

