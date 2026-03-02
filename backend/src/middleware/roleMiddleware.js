import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/appError.js';

export const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.auth?.role) {
      return next(new AppError('User role missing in token', StatusCodes.UNAUTHORIZED));
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return next(new AppError('Forbidden: insufficient permissions', StatusCodes.FORBIDDEN));
    }

    return next();
  };
};
