import { AppError } from '../errors/appError.js';
import { Tenant } from '../models/tenant.model.js';

export const tenantAccessGuard = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return next();
    }

    const tenant = await Tenant.findOne({ _id: req.tenantId }).select('tenantStatus').lean();
    if (!tenant) {
      return next(new AppError('Tenant not found', 404));
    }

    if (tenant.tenantStatus !== 'active') {
      return next(
        new AppError(
          'Your academy account is inactive. Contact administrator.',
          403,
          {
            code: 'TENANT_BLOCKED',
            tenantStatus: tenant.tenantStatus
          },
          {
            errorCode: 'TENANT_BLOCKED'
          }
        )
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
