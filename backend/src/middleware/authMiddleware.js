import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/appError.js';
import { ACCESS_COOKIE_NAME, readCookie } from '../utils/authCookies.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { normalizeRole } from '../constants/roles.js';

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = readCookie(req, ACCESS_COOKIE_NAME);

    if (!cookieToken && (!authHeader || !authHeader.startsWith('Bearer '))) {
      throw new AppError('Authorization token is missing', StatusCodes.UNAUTHORIZED);
    }

    const token = cookieToken || authHeader.slice(7).trim();
    const decoded = verifyAccessToken(token);
    const normalizedRole = normalizeRole(decoded.role);

    if (decoded.tokenType !== 'access') {
      throw new AppError('Invalid access token', StatusCodes.UNAUTHORIZED);
    }
    if (!normalizedRole) {
      throw new AppError('Invalid user role in token', StatusCodes.UNAUTHORIZED);
    }

    req.auth = {
      userId: decoded.sub,
      tenantId: decoded.tenantId,
      role: normalizedRole,
      permissions: decoded.permissions || []
    };
    req.user = { ...decoded, role: normalizedRole };
    req.tenantId = decoded.tenantId || null;

    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired access token', StatusCodes.UNAUTHORIZED));
    }
    return next(error);
  }
};
