import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { AppError } from '../errors/appError.js';
import { PlatformSetting } from '../models/platformSetting.model.js';
import { decryptSecret } from '../utils/secretCipher.js';

const getRuntimeConfig = async () => {
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

const getClient = async () => {
  const config = await getRuntimeConfig();

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

export const getRazorpayPublicKeyId = async () => {
  const config = await getRuntimeConfig();
  return config.keyId;
};

export const verifyRazorpaySignature = async ({ orderId, paymentId, signature }) => {
  const config = await getRuntimeConfig();

  const expected = crypto
    .createHmac('sha256', config.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expected === signature;
};

export const verifyRazorpayWebhookSignature = ({ rawBody, signature }) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    throw new AppError('Razorpay webhook secret is not configured', 503);
  }

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody || '')
    .digest('hex');

  if (!signature || expected.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};
