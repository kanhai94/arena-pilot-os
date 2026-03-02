import { AppError } from '../errors/appError.js';
import { billingService } from '../modules/billing/billing.container.js';

export const subscriptionGuard = (options = {}) => {
  return async (req, res, next) => {
    try {
      const access = await billingService.getGuardAccess(req.tenantId, options);

      if (!access.allowed) {
        return next(
          new AppError(access.reason, access.statusCode, access.meta || null, {
            errorCode: access.meta?.code || null,
            upgradeRequired: access.meta?.code === 'PLAN_LIMIT_REACHED'
          })
        );
      }

      req.subscription = access.subscription;
      return next();
    } catch (error) {
      return next(error);
    }
  };
};
