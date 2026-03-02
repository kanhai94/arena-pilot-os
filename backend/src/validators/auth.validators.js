import { z } from 'zod';

const passwordRule = z.string().min(8).max(72);
const otpCodeRule = z.string().regex(/^\d{6}$/, 'OTP must be 6 digits');
const planNameRule = z.enum(['Starter', 'Growth', 'Pro']);

export const registerTenantSchema = z.object({
  name: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  planName: planNameRule,
  email: z.string().email(),
  adminName: z.string().min(2).max(120),
  adminEmail: z.string().email(),
  adminPassword: passwordRule,
  otpCode: otpCodeRule,
  payment: z
    .object({
      razorpayOrderId: z.string().min(8),
      razorpayPaymentId: z.string().min(8),
      razorpaySignature: z.string().min(16)
    })
    .optional()
});

export const createRegistrationOrderSchema = z.object({
  planName: planNameRule,
  academyEmail: z.string().email(),
  adminEmail: z.string().email()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: passwordRule
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20)
});

export const requestOtpSchema = z.object({
  email: z.string().email()
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otpCode: otpCodeRule
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  otpCode: otpCodeRule,
  newPassword: passwordRule
});

export const parseOrThrow = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(', ');
    const error = new Error(message || 'Validation failed');
    error.statusCode = 400;
    throw error;
  }
  return parsed.data;
};
