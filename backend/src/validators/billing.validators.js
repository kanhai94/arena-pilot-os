import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const objectIdRegex = /^[a-f0-9]{24}$/i;

export const createPlanSchema = z
  .object({
    name: z.string().min(2).max(50),
    priceMonthly: z.coerce.number().min(0),
    studentLimit: z.coerce.number().int().min(1).max(100000),
    features: z.array(z.string().min(1).max(100)).max(100).default([]),
    status: z.enum(['active', 'inactive']).optional()
  })
  .strict();

export const subscribeTenantSchema = z
  .object({
    planId: z.string().regex(objectIdRegex, 'Invalid planId'),
    startDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
    autoRenew: z.boolean().optional()
  })
  .strict();

export const upgradePlanSchema = z
  .object({
    planId: z.string().regex(objectIdRegex, 'Invalid planId'),
    autoRenew: z.boolean().optional()
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
