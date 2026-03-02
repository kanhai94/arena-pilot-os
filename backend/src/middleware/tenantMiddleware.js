import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/appError.js';

export const tenantMiddleware = (req, res, next) => {
  if (!req.auth?.tenantId) {
    return next(new AppError('Tenant context missing in token', StatusCodes.UNAUTHORIZED));
  }

  req.tenantId = req.auth.tenantId;
  return next();
};
