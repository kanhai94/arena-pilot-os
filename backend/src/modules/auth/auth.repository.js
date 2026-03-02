import { Tenant } from '../../models/tenant.model.js';
import { User } from '../../models/user.model.js';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { AuthOtp } from '../../models/authOtp.model.js';
import { Counter } from '../../models/counter.model.js';
import { RegistrationPayment } from '../../models/registrationPayment.model.js';
import { env } from '../../config/env.js';

export const authRepository = {
  createTenant(payload) {
    return Tenant.create(payload);
  },

  createRegistrationPayment(payload) {
    return RegistrationPayment.create(payload);
  },

  findRegistrationPaymentByOrderId(razorpayOrderId) {
    return RegistrationPayment.findOne({ razorpayOrderId }).lean();
  },

  findRegistrationPaymentByOrderAndPayment(razorpayOrderId, razorpayPaymentId) {
    return RegistrationPayment.findOne({ razorpayOrderId, razorpayPaymentId }).lean();
  },

  updateRegistrationPaymentByOrderId(razorpayOrderId, payload) {
    return RegistrationPayment.findOneAndUpdate({ razorpayOrderId }, { $set: payload }, { new: true, lean: true });
  },

  markRegistrationPaymentConsumed(razorpayOrderId, tenantId) {
    return RegistrationPayment.findOneAndUpdate(
      { razorpayOrderId },
      { $set: { consumedAt: new Date(), tenantId } },
      { new: true, lean: true }
    );
  },

  async getNextAcademySequence() {
    const counter = await Counter.findOneAndUpdate(
      { name: 'academy_code' },
      { $inc: { lastValue: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
    );

    return counter.lastValue;
  },

  deleteTenantById(tenantId) {
    return Tenant.deleteOne({ _id: tenantId });
  },

  createUser(payload) {
    return User.create(payload);
  },

  findTenantById(tenantId) {
    return Tenant.findById(tenantId).lean();
  },

  findUserByEmailWithPassword(email) {
    return User.findOne({ email: email.toLowerCase(), isActive: true }).select('+passwordHash').lean();
  },

  findUserByEmail(email) {
    return User.findOne({ email: email.toLowerCase(), isActive: true }).lean();
  },

  findUserById(userId) {
    return User.findById(userId).lean();
  },

  updateUserPassword(userId, passwordHash) {
    return User.updateOne({ _id: userId }, { $set: { passwordHash } });
  },

  createRefreshToken(payload) {
    return RefreshToken.create(payload);
  },

  findRefreshTokenByHash(tokenHash) {
    return RefreshToken.findOne({ tokenHash }).lean();
  },

  consumeRefreshToken(tokenHash) {
    return RefreshToken.findOneAndUpdate(
      {
        tokenHash,
        revokedAt: null,
        expiresAt: { $gte: new Date() }
      },
      { $set: { revokedAt: new Date() } },
      { new: true, lean: true }
    );
  },

  revokeRefreshToken(tokenHash) {
    return RefreshToken.updateOne({ tokenHash, revokedAt: null }, { $set: { revokedAt: new Date() } });
  },

  revokeAllUserRefreshTokens(userId) {
    return RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  },

  async createOtp(payload) {
    await AuthOtp.deleteMany({ email: payload.email, purpose: payload.purpose });
    return AuthOtp.create(payload);
  },

  findLatestOtp(email, purpose) {
    return AuthOtp.findOne({ email: email.toLowerCase(), purpose }).sort({ createdAt: -1 }).lean();
  },

  incrementOtpAttempts(otpId) {
    return AuthOtp.updateOne({ _id: otpId }, { $inc: { attempts: 1 } });
  },

  markOtpVerified(otpId) {
    return AuthOtp.updateOne({ _id: otpId }, { $set: { verifiedAt: new Date() } });
  },

  deleteOtp(otpId) {
    return AuthOtp.deleteOne({ _id: otpId });
  },

  countTotalTenants() {
    return Tenant.countDocuments({ email: { $ne: env.SUPER_ADMIN_EMAIL.toLowerCase() } });
  },

  countTodayTenants() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Tenant.countDocuments({
      email: { $ne: env.SUPER_ADMIN_EMAIL.toLowerCase() },
      createdAt: { $gte: start }
    });
  },

  countMonthTenants() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return Tenant.countDocuments({
      email: { $ne: env.SUPER_ADMIN_EMAIL.toLowerCase() },
      createdAt: { $gte: start }
    });
  }
};
