import { apiSuccess } from '../../utils/apiResponse.js';
import { parseOrThrow, updateIntegrationSchema } from '../../validators/integration.validators.js';

export const createIntegrationController = (service) => {
  return {
    getTenantIntegrations: async (_req, res, next) => {
      try {
        const data = await service.getTenantIntegrations();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    updateTenantIntegrations: async (req, res, next) => {
      try {
        const payload = parseOrThrow(updateIntegrationSchema, req.body);
        const data = await service.updateTenantIntegrations(payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
