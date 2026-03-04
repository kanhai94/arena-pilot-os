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
import {
  createRegistrationOrder as createRazorpayRegistrationOrder,
  getRazorpayPublicKeyId,
  verifyRazorpaySignature
} from '../../adapters/razorpay.adapter.js';

const generateOtpCode = () => String(crypto.randomInt(100000, 999999));
const PLAN_SIZE_MAP = {
  Starter: 10,
  Growth: 50,
  Pro: null
};
const PAID_PLANS = new Set(['Growth', 'Pro']);

export const createAuthService = (repository, dependencies = {}) => {
  const { tenantMetricsService } = dependencies;

  const createRegistrationOrder = async ({ planName, academyEmail, adminEmail }) => {
    if (!PAID_PLANS.has(planName)) {
      throw new AppError('Starter plan does not require payment', StatusCodes.BAD_REQUEST);
    }

    const quote = await billingService.getRegistrationPlanQuote(planName);
    if (quote.amountInPaise <= 0) {
      throw new AppError('Selected plan has no payable amount', StatusCodes.BAD_REQUEST);
    }

    const receipt = `reg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    let order = null;
    try {
      order = await createRazorpayRegistrationOrder({
        amount: quote.amountInPaise,
        currency: quote.currency,
        receipt,
        notes: {
          planName,
          academyEmail: academyEmail.toLowerCase(),
          adminEmail: adminEmail.toLowerCase()
        }
      });
    } catch (error) {
      logger.error({ err: error, planName, academyEmail, adminEmail }, 'Razorpay order create failed');
      throw new AppError('Unable to initialize payment. Please verify Razorpay settings.', StatusCodes.BAD_GATEWAY);
    }

    await repository.createRegistrationPayment({
      planName,
      amount: quote.amountInPaise,
      currency: quote.currency,
      academyEmail: academyEmail.toLowerCase(),
      adminEmail: adminEmail.toLowerCase(),
      razorpayOrderId: order.id,
      status: 'created'
    });

    return {
      keyId: await getRazorpayPublicKeyId(),
      orderId: order.id,
      amount: quote.amountInPaise,
      currency: quote.currency,
      planName
    };
  };

  const verifyPaidPlanPayment = async ({ planName, adminEmail, academyEmail, payment }) => {
    if (!PAID_PLANS.has(planName)) {
      return null;
    }

    if (!payment?.razorpayOrderId || !payment?.razorpayPaymentId || !payment?.razorpaySignature) {
      throw new AppError('Payment is required for selected plan', StatusCodes.BAD_REQUEST);
    }

    const row = await repository.findRegistrationPaymentByOrderId(payment.razorpayOrderId);
    if (!row) {
      throw new AppError('Payment order not found', StatusCodes.BAD_REQUEST);
    }

    if (row.planName !== planName) {
      throw new AppError('Plan mismatch for payment', StatusCodes.BAD_REQUEST);
    }

    if (row.adminEmail !== adminEmail.toLowerCase() || row.academyEmail !== academyEmail.toLowerCase()) {
      throw new AppError('Payment does not belong to this registration', StatusCodes.BAD_REQUEST);
    }

    if (row.consumedAt) {
      throw new AppError('Payment already used for a registration', StatusCodes.CONFLICT);
    }

    const signatureValid = await verifyRazorpaySignature({
      orderId: payment.razorpayOrderId,
      paymentId: payment.razorpayPaymentId,
      signature: payment.razorpaySignature
    });

    if (!signatureValid) {
      await repository.updateRegistrationPaymentByOrderId(payment.razorpayOrderId, {
        status: 'failed',
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpaySignature: payment.razorpaySignature
      });
      throw new AppError('Invalid payment signature', StatusCodes.BAD_REQUEST);
    }

    const alreadyLinked = await repository.findRegistrationPaymentByOrderAndPayment(
      payment.razorpayOrderId,
      payment.razorpayPaymentId
    );

    if (!alreadyLinked || alreadyLinked.status !== 'captured') {
      await repository.updateRegistrationPaymentByOrderId(payment.razorpayOrderId, {
        status: 'captured',
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpaySignature: payment.razorpaySignature,
        paidAt: new Date()
      });
    }

    return payment.razorpayOrderId;
  };

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
    const separator = env.ACADEMY_CODE_SEPARATOR ?? '-';
    return `${prefix}${separator}${String(nextValue).padStart(env.ACADEMY_CODE_PAD, '0')}`;
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
    createRegistrationOrder,

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
      await repository.updateUserPassword(user._id, user.tenantId, passwordHash);
      await repository.revokeAllUserRefreshTokens(user._id, user.tenantId);

      return { reset: true };
    },

    async registerTenant(payload) {
      let tenant = null;

      const paymentOrderId = await verifyPaidPlanPayment({
        planName: payload.planName,
        adminEmail: payload.adminEmail,
        academyEmail: payload.email,
        payment: payload.payment
      });
      await verifyOtp(payload.adminEmail, 'signup', payload.otpCode, { consume: true });

      try {
        tenant = await repository.createTenant({
          name: payload.name,
          academyCode: await generateAcademyCode(),
          ownerName: payload.ownerName,
          academySize: PLAN_SIZE_MAP[payload.planName] ?? null,
          requestedPlanName: payload.planName,
          email: payload.email,
          subscriptionStatus: 'trial',
          currentPlanId: null,
          planName: null,
          studentLimit: null,
          planStartDate: null,
          planEndDate: null
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

        if (payload.planName === 'Starter') {
          await billingService.createTrialForTenant(String(tenant._id));
        } else {
          await billingService.activateTenantPlanByName(String(tenant._id), payload.planName, true);
          await repository.markRegistrationPaymentConsumed(paymentOrderId, tenant._id);
        }

        const refreshedTenant = await repository.findTenantById?.(tenant._id);

        return {
          tenant: {
            id: String(tenant._id),
            name: tenant.name,
            academyCode: tenant.academyCode,
            ownerName: tenant.ownerName,
            academySize: tenant.academySize ?? null,
            requestedPlanName: tenant.requestedPlanName || 'Starter',
            email: tenant.email,
            subscriptionStatus: refreshedTenant?.subscriptionStatus || tenant.subscriptionStatus,
            currentPlanId: refreshedTenant?.currentPlanId || null,
            planName: refreshedTenant?.planName || null,
            studentLimit: refreshedTenant?.studentLimit ?? null,
            planStartDate: refreshedTenant?.planStartDate || null,
            planEndDate: refreshedTenant?.planEndDate || null,
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

      if (tenantMetricsService?.markLogin) {
        await tenantMetricsService.markLogin(String(user.tenantId));
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
      const consumedToken = await repository.consumeRefreshToken(tokenHash, decoded.sub, decoded.tenantId);
      if (!consumedToken) {
        throw new AppError('Refresh token expired or revoked', StatusCodes.UNAUTHORIZED);
      }

      if (String(consumedToken.userId) !== decoded.sub || String(consumedToken.tenantId) !== decoded.tenantId) {
        throw new AppError('Invalid refresh token', StatusCodes.UNAUTHORIZED);
      }

      const user = await repository.findUserById(decoded.sub, decoded.tenantId);
      if (!user || !user.isActive) {
        throw new AppError('User not found or inactive', StatusCodes.UNAUTHORIZED);
      }

      return buildTokenResponse(user, requestMeta);
    },

    async logout(refreshToken) {
      let decoded = null;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch {
        throw new AppError('Invalid refresh token', StatusCodes.UNAUTHORIZED);
      }

      const tokenHash = hashToken(refreshToken);
      await repository.revokeRefreshToken(tokenHash, decoded.sub, decoded.tenantId);
      return { loggedOut: true };
    },

    async getMyProfile(userId, tenantId) {
      const user = await repository.findUserById(userId, tenantId);
      if (!user || !user.isActive) {
        throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      const tenant = await repository.findTenantById(user.tenantId);

      return {
        id: String(user._id),
        tenantId: String(user.tenantId),
        academyCode: tenant?.academyCode || null,
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
