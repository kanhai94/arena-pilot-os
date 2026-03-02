import { z } from 'zod';
import { AppError } from '../errors/appError.js';

export const superAdminTenantsQuerySchema = z.object({
  plan: z.string().trim().min(2).max(50).optional(),
  status: z.enum(['trial', 'active', 'expired', 'suspended', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

export const updateRazorpaySettingsSchema = z
  .object({
    keyId: z.string().min(10).max(64),
    keySecret: z.string().min(10).max(128),
    isActive: z.boolean().default(true)
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
