import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/appError.js';
import { verifyAccessToken } from '../utils/jwt.js';

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authorization token is missing', StatusCodes.UNAUTHORIZED);
    }

    const token = authHeader.slice(7).trim();
    const decoded = verifyAccessToken(token);

    if (decoded.tokenType !== 'access') {
      throw new AppError('Invalid access token', StatusCodes.UNAUTHORIZED);
    }

    req.auth = {
      userId: decoded.sub,
      tenantId: decoded.tenantId,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired access token', StatusCodes.UNAUTHORIZED));
    }
    return next(error);
  }
};
