import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const smtpSchema = z
  .object({
    host: z.string().trim().min(1).optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    user: z.string().trim().min(1).optional(),
    password: z.string().min(1).optional(),
    fromEmail: z.string().email().optional()
  })
  .strict()
  .optional();

const emailApiSchema = z
  .object({
    endpoint: z.string().url().optional(),
    apiKey: z.string().min(1).optional(),
    headers: z.string().min(1).optional(),
    exampleCurl: z.string().min(1).optional()
  })
  .strict()
  .optional();

const emailSchema = z
  .object({
    type: z.enum(['smtp', 'api']).optional(),
    smtp: smtpSchema,
    api: emailApiSchema
  })
  .strict()
  .optional();

const smsApiSchema = z
  .object({
    endpoint: z.string().url().optional(),
    apiKey: z.string().min(1).optional(),
    headers: z.string().min(1).optional()
  })
  .strict()
  .optional();

const smsSchema = z
  .object({
    type: z.enum(['api', 'curl']).optional(),
    api: smsApiSchema,
    curlTemplate: z.string().min(1).optional()
  })
  .strict()
  .optional();

const whatsappSchema = z
  .object({
    type: z.enum(['api', 'curl']).optional(),
    api: smsApiSchema,
    curlTemplate: z.string().min(1).optional()
  })
  .strict()
  .optional();

const razorpaySchema = z
  .object({
    keyId: z.string().min(4).optional(),
    secret: z.string().min(4).optional(),
    webhookSecret: z.string().min(4).optional()
  })
  .strict()
  .optional();

export const updateIntegrationSchema = z
  .object({
    email: emailSchema,
    sms: smsSchema,
    whatsapp: whatsappSchema,
    razorpay: razorpaySchema
  })
  .strict();

export const parseOrThrow = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    throw new AppError('Validation failed', 400, details);
  }
  return parsed.data;
};
