import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/appError.js';
import { normalizeRole } from '../constants/roles.js';

export const authorizeRoles = (...allowedRoles) => {
  const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role) || role);

  return (req, res, next) => {
    const currentRole = normalizeRole(req.auth?.role || req.user?.role);

    if (!currentRole) {
      return next(new AppError('User role missing in token', StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED'));
    }

    if (!normalizedAllowedRoles.includes(currentRole)) {
      return next(
        new AppError(
          'You do not have permission to perform this action',
          StatusCodes.FORBIDDEN,
          'FORBIDDEN'
        )
      );
    }

    return next();
  };
};

