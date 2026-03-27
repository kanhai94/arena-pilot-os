import { z } from 'zod';
import { AppError } from '../errors/appError.js';

export const superAdminTenantsQuerySchema = z.object({
  plan: z.string().trim().min(2).max(50).optional(),
  status: z.enum(['trial', 'active', 'expired', 'suspended', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

export const adminTenantIdParamsSchema = z
  .object({
    id: z.string().trim().min(8)
  })
  .strict();

export const createOrUpdateTenantSchema = z
  .object({
    academyName: z.string().trim().min(2).max(120),
    ownerName: z.string().trim().min(2).max(120),
    planName: z.string().trim().min(2).max(80).default('Starter'),
    billingEmail: z.string().email().nullable().optional(),
    subscriptionStatus: z.enum(['trial', 'active', 'expired', 'suspended', 'cancelled']).default('trial'),
    tenantStatus: z.enum(['active', 'blocked', 'suspended']).default('active'),
    paymentStatus: z.enum(['paid', 'pending', 'failed']).default('pending'),
    nextPaymentDate: z.string().date().nullable().optional(),
    customPriceOverride: z.number().min(0).nullable().optional()
  })
  .strict();

export const updateTenantStatusSchema = z
  .object({
    tenantStatus: z.enum(['active', 'blocked', 'suspended'])
  })
  .strict();

export const updateTenantPriceOverrideSchema = z
  .object({
    customPriceOverride: z.number().min(0).nullable()
  })
  .strict();

export const updateRazorpaySettingsSchema = z
  .object({
    keyId: z.string().min(10).max(64),
    keySecret: z.string().min(10).max(128),
    isActive: z.boolean().default(true)
  })
  .strict();

export const updatePlatformIntegrationsSchema = z
  .object({
    whatsappProviderKey: z.string().trim().optional(),
    smtp: z
      .object({
        host: z.string().trim().optional(),
        port: z.union([z.coerce.number().int().min(1).max(65535), z.literal(0)]).optional(),
        user: z.string().trim().optional(),
        pass: z.string().trim().optional(),
        from: z.string().trim().optional()
      })
      .strict()
      .optional()
  })
  .strict();

export const adminPlanIdParamsSchema = z
  .object({
    id: z.string().trim().min(1)
  })
  .strict();

export const updateAdminPlanSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    priceMonthly: z.number().min(0).optional(),
    studentLimit: z.number().int().min(1).nullable().optional(),
    features: z.array(z.string().trim().min(1).max(120)).optional(),
    status: z.enum(['active', 'inactive']).optional()
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required for update'
  });

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
