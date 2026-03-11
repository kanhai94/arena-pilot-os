import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { AppError } from '../errors/appError.js';
import { PlatformSetting } from '../models/platformSetting.model.js';
import { TenantIntegration } from '../modules/integrations/integration.model.js';
import { decryptSecret } from '../utils/secretCipher.js';

const getPlatformConfig = async () => {
  const settings = await PlatformSetting.findOne({ key: 'platform' }).lean();
  const fromSettings = settings?.payments?.razorpay;

  if (fromSettings?.isActive && fromSettings?.keyId && fromSettings?.keySecretEnc) {
    return {
      keyId: fromSettings.keyId,
      keySecret: decryptSecret(fromSettings.keySecretEnc)
    };
  }

  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    return {
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET
    };
  }

  throw new AppError('Payment gateway is not configured', 503);
};

const getTenantConfig = async (tenantId) => {
  if (!tenantId) return null;
  const record = await TenantIntegration.findOne({ tenantId }).lean();
  const razorpay = record?.razorpay;
  if (!razorpay?.keyId || !razorpay?.secretEnc) return null;

  return {
    keyId: razorpay.keyId,
    keySecret: decryptSecret(razorpay.secretEnc)
  };
};

const getRuntimeConfig = async ({ tenantId = null, preferTenant = false } = {}) => {
  if (preferTenant && tenantId) {
    const tenantConfig = await getTenantConfig(tenantId);
    if (tenantConfig) {
      return tenantConfig;
    }
  }

  return getPlatformConfig();
};

const getClient = async (options = {}) => {
  const config = await getRuntimeConfig(options);

  return new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret
  });
};

export const createRegistrationOrder = async ({ amount, currency, receipt, notes }) => {
  const client = await getClient();
  return client.orders.create({
    amount,
    currency,
    receipt,
    payment_capture: true,
    notes
  });
};

export const getRazorpayPublicKeyId = async (options = {}) => {
  const config = await getRuntimeConfig(options);
  return config.keyId;
};

export const verifyRazorpaySignature = async ({ orderId, paymentId, signature, tenantId = null, preferTenant = false }) => {
  const config = await getRuntimeConfig({ tenantId, preferTenant });

  const expected = crypto
    .createHmac('sha256', config.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expected === signature;
};

export const createTenantOrder = async ({ tenantId, amount, currency, receipt, notes }) => {
  const client = await getClient({ tenantId, preferTenant: true });
  return client.orders.create({
    amount,
    currency,
    receipt,
    payment_capture: true,
    notes
  });
};

const computeWebhookSignature = (secret, rawBody) =>
  crypto.createHmac('sha256', secret).update(rawBody || '').digest('hex');

export const verifyRazorpayWebhookSignature = ({ rawBody, signature, secret }) => {
  const secretToUse = secret || env.RAZORPAY_WEBHOOK_SECRET;
  if (!secretToUse) {
    throw new AppError('Razorpay webhook secret is not configured', 503);
  }

  const expected = computeWebhookSignature(secretToUse, rawBody);

  if (!signature || expected.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};
