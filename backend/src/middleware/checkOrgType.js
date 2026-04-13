import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/appError.js';
import { Tenant } from '../models/tenant.model.js';

const SUPPORTED_ORG_TYPES = new Set(['SPORTS', 'SCHOOL']);

export const checkOrgType = (allowedOrgType) => {
  if (!SUPPORTED_ORG_TYPES.has(allowedOrgType)) {
    throw new Error(`Unsupported organization type: ${allowedOrgType}`);
  }

  return async (req, _res, next) => {
    try {
      if (!req.tenantId) {
        return next(new AppError('Tenant context missing', StatusCodes.UNAUTHORIZED));
      }

      const tenant = await Tenant.findOne({ _id: req.tenantId }).select('organizationType').lean();
      if (!tenant) {
        return next(new AppError('Tenant not found', StatusCodes.NOT_FOUND));
      }

      const organizationType = tenant.organizationType || 'SPORTS';
      if (organizationType !== allowedOrgType) {
        return next(
          new AppError(`This route is only available for ${allowedOrgType} organizations`, StatusCodes.FORBIDDEN, {
            organizationType,
            allowedOrganizationType: allowedOrgType
          })
        );
      }

      req.organizationType = organizationType;
      return next();
    } catch (error) {
      return next(error);
    }
  };
};
