import crypto from 'node:crypto';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { ROLES } from '../../constants/roles.js';
import { ROLE_DEFAULT_PERMISSIONS } from '../../constants/permissions.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { hashToken } from '../../utils/crypto.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { billingService } from '../billing/billing.container.js';
import { sendOtpEmail } from '../../adapters/email.adapter.js';

const generateOtpCode = () => String(crypto.randomInt(100000, 999999));

export const createAuthService = (repository) => {
  const buildTokenResponse = async (user, requestMeta = {}) => {
    const userId = String(user._id);
    const tenantId = String(user.tenantId);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const accessToken = signAccessToken({
        userId,
        tenantId,
        role: user.role,
        permissions: user.permissions || []
      });

      const refreshToken = signRefreshToken({
        userId,
        tenantId,
        role: user.role,
        permissions: user.permissions || []
      });

      const decodedRefresh = verifyRefreshToken(refreshToken);

      try {
        await repository.createRefreshToken({
          userId,
          tenantId,
          tokenHash: hashToken(refreshToken),
          expiresAt: new Date(decodedRefresh.exp * 1000),
          userAgent: requestMeta.userAgent || null,
          ipAddress: requestMeta.ipAddress || null
        });
      } catch (error) {
        if (error?.code === 11000) {
          continue;
        }
        throw error;
      }

      return {
        accessToken,
        refreshToken,
        user: {
          id: userId,
          tenantId,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          permissions: user.permissions || []
        }
      };
    }

    throw new AppError('Unable to generate auth tokens. Please retry login.', StatusCodes.INTERNAL_SERVER_ERROR);
  };

  const generateAcademyCode = async () => {
    const nextValue = await repository.getNextAcademySequence();
    const prefix = env.ACADEMY_CODE_PREFIX.toLowerCase();
    return `${prefix}-${String(nextValue).padStart(env.ACADEMY_CODE_PAD, '0')}`;
  };

  const requestOtp = async (email, purpose) => {
    const normalizedEmail = email.toLowerCase();
    const otpCode = generateOtpCode();

    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + env.OTP_EXPIRY_MINUTES);

    await repository.createOtp({
      email: normalizedEmail,
      purpose,
      codeHash: hashToken(otpCode),
      expiresAt: expiry,
      attempts: 0,
      verifiedAt: null
    });

    let emailStatus = { sent: false };

    try {
      emailStatus = await sendOtpEmail({
        to: normalizedEmail,
        otpCode,
        purpose,
        expiryMinutes: env.OTP_EXPIRY_MINUTES
      });
    } catch (error) {
      logger.error(
        { err: error, email: normalizedEmail, purpose },
        'OTP email delivery failed'
      );

      if (env.NODE_ENV !== 'development') {
        throw new AppError(
          'OTP delivery failed. Please check email configuration and try again.',
          StatusCodes.BAD_GATEWAY
        );
      }
    }

    logger.info(
      { email: normalizedEmail, purpose, otpSent: emailStatus.sent },
      'OTP dispatch attempted'
    );

    return {
      sent: emailStatus.sent,
      email: normalizedEmail,
      purpose,
      expiresInMinutes: env.OTP_EXPIRY_MINUTES,
      ...(env.NODE_ENV === 'development' ? { devOtp: otpCode } : {}),
      ...(emailStatus.sent
        ? {}
        : {
            warning:
              'Email delivery failed. Using development OTP fallback.'
          })
    };
  };

  const verifyOtp = async (email, purpose, otpCode, { consume = false } = {}) => {
    const normalizedEmail = email.toLowerCase();
    const otpRow = await repository.findLatestOtp(normalizedEmail, purpose);

    if (!otpRow) {
      throw new AppError('OTP not found. Please request a new OTP.', StatusCodes.BAD_REQUEST);
    }

    if (otpRow.verifiedAt && !consume) {
      return { verified: true };
    }

    if (otpRow.expiresAt && new Date(otpRow.expiresAt) < new Date()) {
      throw new AppError('OTP expired. Please request a new OTP.', StatusCodes.BAD_REQUEST);
    }

    if (otpRow.attempts >= env.OTP_MAX_ATTEMPTS) {
      throw new AppError('OTP attempt limit exceeded. Request a new OTP.', StatusCodes.TOO_MANY_REQUESTS);
    }

    if (hashToken(otpCode) !== otpRow.codeHash) {
      await repository.incrementOtpAttempts(otpRow._id);
      throw new AppError('Invalid OTP code.', StatusCodes.BAD_REQUEST);
    }

    if (consume) {
      await repository.deleteOtp(otpRow._id);
      return { verified: true, consumed: true };
    }

    await repository.markOtpVerified(otpRow._id);
    return { verified: true };
  };

  return {
    async requestSignupOtp(email) {
      const existingUser = await repository.findUserByEmail(email);
      if (existingUser) {
        throw new AppError('Admin email already registered. Please login instead.', StatusCodes.CONFLICT);
      }

      return requestOtp(email, 'signup');
    },

    verifySignupOtp(email, otpCode) {
      return verifyOtp(email, 'signup', otpCode);
    },

    requestForgotPasswordOtp(email) {
      return requestOtp(email, 'forgotPassword');
    },

    async resetPasswordWithOtp({ email, otpCode, newPassword }) {
      await verifyOtp(email, 'forgotPassword', otpCode, { consume: true });

      const user = await repository.findUserByEmailWithPassword(email);
      if (!user) {
        throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      const passwordHash = await hashPassword(newPassword);
      await repository.updateUserPassword(user._id, passwordHash);
      await repository.revokeAllUserRefreshTokens(user._id);

      return { reset: true };
    },

    async registerTenant(payload) {
      let tenant = null;

      await verifyOtp(payload.adminEmail, 'signup', payload.otpCode, { consume: true });

      try {
        tenant = await repository.createTenant({
          name: payload.name,
          academyCode: await generateAcademyCode(),
          ownerName: payload.ownerName,
          email: payload.email,
          subscriptionStatus: 'trial',
          currentPlanId: null
        });

        const adminPasswordHash = await hashPassword(payload.adminPassword);

        const adminUser = await repository.createUser({
          tenantId: tenant._id,
          fullName: payload.adminName,
          email: payload.adminEmail,
          passwordHash: adminPasswordHash,
          role: ROLES.ACADEMY_ADMIN,
          permissions: ROLE_DEFAULT_PERMISSIONS[ROLES.ACADEMY_ADMIN]
        });

        await billingService.createTrialForTenant(String(tenant._id));

        const refreshedTenant = await repository.findTenantById?.(tenant._id);

        return {
          tenant: {
            id: String(tenant._id),
            name: tenant.name,
            academyCode: tenant.academyCode,
            ownerName: tenant.ownerName,
            email: tenant.email,
            subscriptionStatus: refreshedTenant?.subscriptionStatus || tenant.subscriptionStatus,
            currentPlanId: refreshedTenant?.currentPlanId || null,
            createdAt: tenant.createdAt
          },
          adminUser: {
            id: String(adminUser._id),
            fullName: adminUser.fullName,
            email: adminUser.email,
            role: adminUser.role,
            permissions: adminUser.permissions || []
          }
        };
      } catch (error) {
        if (tenant?._id) {
          await repository.deleteTenantById(tenant._id);
        }

        if (error?.code === 11000) {
          throw new AppError('Tenant or user already exists with given email', StatusCodes.CONFLICT);
        }

        throw error;
      }
    },

    async login({ email, password }, requestMeta) {
      const user = await repository.findUserByEmailWithPassword(email);

      if (!user) {
        throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED);
      }

      const isValidPassword = await verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED);
      }

      return buildTokenResponse(user, requestMeta);
    },

    async refreshToken(refreshToken, requestMeta) {
      let decoded = null;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch {
        throw new AppError('Invalid refresh token', StatusCodes.UNAUTHORIZED);
      }

      const tokenHash = hashToken(refreshToken);
      const consumedToken = await repository.consumeRefreshToken(tokenHash);
      if (!consumedToken) {
        throw new AppError('Refresh token expired or revoked', StatusCodes.UNAUTHORIZED);
      }

      if (String(consumedToken.userId) !== decoded.sub || String(consumedToken.tenantId) !== decoded.tenantId) {
        throw new AppError('Invalid refresh token', StatusCodes.UNAUTHORIZED);
      }

      const user = await repository.findUserById(decoded.sub);
      if (!user || !user.isActive) {
        throw new AppError('User not found or inactive', StatusCodes.UNAUTHORIZED);
      }

      return buildTokenResponse(user, requestMeta);
    },

    async logout(refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await repository.revokeRefreshToken(tokenHash);
      return { loggedOut: true };
    },

    async getMyProfile(userId) {
      const user = await repository.findUserById(userId);
      if (!user || !user.isActive) {
        throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      return {
        id: String(user._id),
        tenantId: String(user.tenantId),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        permissions: user.permissions || []
      };
    },

    async getRegistrationStats() {
      const [totalTenants, todayTenants, monthTenants] = await Promise.all([
        repository.countTotalTenants(),
        repository.countTodayTenants(),
        repository.countMonthTenants()
      ]);

      return {
        totalRegistrations: totalTenants,
        todayRegistrations: todayTenants,
        thisMonthRegistrations: monthTenants
      };
    }
  };
};
