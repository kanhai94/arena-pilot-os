import { billingService } from '../modules/billing/billing.container.js';
import { AppError } from '../errors/appError.js';

export const checkPlanLimit = (resourceType) => {
  return async (req, res, next) => {
    try {
      const limitResult = await billingService.checkPlanLimit(undefined, resourceType);

      if (!limitResult.allowed) {
        return next(
          new AppError(
            'Student limit reached. Upgrade your plan.',
            403,
            {
              code: 'PLAN_LIMIT_REACHED',
              resourceType,
              studentLimit: limitResult.studentLimit,
              currentUsage: limitResult.currentUsage
            },
            {
              errorCode: 'PLAN_LIMIT_REACHED',
              upgradeRequired: true
            }
          )
        );
      }

      req.planLimit = limitResult;
      return next();
    } catch (error) {
      return next(error);
    }
  };
};
