import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const objectIdRegex = /^[a-f0-9]{24}$/i;

export const createPlanSchema = z
  .object({
    name: z.string().min(2).max(50),
    priceMonthly: z.coerce.number().min(0),
    studentLimit: z
      .preprocess(
        (value) => {
          if (value === undefined || value === null || value === '') {
            return null;
          }
          return value;
        },
        z.union([z.coerce.number().int().min(1).max(100000), z.null()])
      )
      .default(null),
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

export const createTenantOrderSchema = z
  .object({
    amount: z.coerce.number().positive(),
    currency: z.string().min(3).max(5).default('INR'),
    receipt: z.string().min(3).max(64).optional(),
    notes: z
      .object({
        studentId: z.string().regex(objectIdRegex, 'Invalid studentId').optional(),
        subscriptionId: z.string().regex(objectIdRegex, 'Invalid subscriptionId').optional(),
        planId: z.string().regex(objectIdRegex, 'Invalid planId').optional(),
        purpose: z.string().max(100).optional()
      })
      .partial()
      .optional()
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
