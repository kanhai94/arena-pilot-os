import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import { clearAuthCookies, readCookie, REFRESH_COOKIE_NAME, setAuthCookies } from '../../utils/authCookies.js';
import {
  createRegistrationOrderSchema,
  loginSchema,
  parseOrThrow,
  refreshTokenSchema,
  registerTenantSchema,
  requestOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema
} from '../../validators/auth.validators.js';

export const createAuthController = (authService) => {
  const buildSessionResponse = (data) => ({
    user: data.user,
    accessToken: data.accessToken
  });

  return {
    getRegistrationPlans: async (_req, res, next) => {
      try {
        const data = await authService.getRegistrationPlans();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    createRegistrationOrder: async (req, res, next) => {
      try {
        const payload = parseOrThrow(createRegistrationOrderSchema, req.body);
        const data = await authService.createRegistrationOrder(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    requestSignupOtp: async (req, res, next) => {
      try {
        const payload = parseOrThrow(requestOtpSchema, req.body);
        const data = await authService.requestSignupOtp(payload.email);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    verifySignupOtp: async (req, res, next) => {
      try {
        const payload = parseOrThrow(verifyOtpSchema, req.body);
        const data = await authService.verifySignupOtp(payload.email, payload.otpCode);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    requestForgotPasswordOtp: async (req, res, next) => {
      try {
        const payload = parseOrThrow(requestOtpSchema, req.body);
        const data = await authService.requestForgotPasswordOtp(payload.email);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    resetPasswordWithOtp: async (req, res, next) => {
      try {
        const payload = parseOrThrow(resetPasswordSchema, req.body);
        const data = await authService.resetPasswordWithOtp(payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    registerTenant: async (req, res, next) => {
      try {
        const payload = parseOrThrow(registerTenantSchema, req.body);
        const data = await authService.registerTenant(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    login: async (req, res, next) => {
      try {
        const payload = parseOrThrow(loginSchema, req.body);
        const data = await authService.login(payload, {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip
        });
        setAuthCookies(res, data);
        return apiSuccess(res, buildSessionResponse(data));
      } catch (error) {
        return next(error);
      }
    },

    refreshToken: async (req, res, next) => {
      try {
        const payload = parseOrThrow(refreshTokenSchema, req.body);
        const refreshToken = payload.refreshToken || readCookie(req, REFRESH_COOKIE_NAME);
        const data = await authService.refreshToken(refreshToken, {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip
        });
        setAuthCookies(res, data);
        return apiSuccess(res, buildSessionResponse(data));
      } catch (error) {
        clearAuthCookies(res);
        return next(error);
      }
    },

    logout: async (req, res, next) => {
      try {
        const payload = parseOrThrow(refreshTokenSchema, req.body);
        const refreshToken = payload.refreshToken || readCookie(req, REFRESH_COOKIE_NAME);
        const data = await authService.logout(refreshToken);
        clearAuthCookies(res);
        return apiSuccess(res, data);
      } catch (error) {
        clearAuthCookies(res);
        return next(error);
      }
    },

    getMe: async (req, res, next) => {
      try {
        const data = await authService.getMyProfile(req.auth.userId);
        return apiSuccess(res, { ...data, accessToken: req.accessToken || null });
      } catch (error) {
        return next(error);
      }
    },

    getRegistrationStats: async (req, res, next) => {
      try {
        const data = await authService.getRegistrationStats();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    protectedTenantEcho: async (req, res) => {
      return apiSuccess(res, {
        message: 'Protected tenant route accessed',
        tenantId: req.tenantId,
        role: req.auth.role,
        permissions: req.auth.permissions || []
      });
    }
  };
};
