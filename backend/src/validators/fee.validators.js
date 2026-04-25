import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const objectIdRegex = /^[a-f0-9]{24}$/i;
const paymentStatusSchema = z.enum(['PAID', 'PENDING', 'OVERDUE']);
const paymentModeSchema = z.enum(['CASH', 'ONLINE', 'UPI']);
const discountTypeSchema = z.enum(['NONE', 'PERCENT', 'AMOUNT']);
const discountScopeSchema = z.enum(['ONE_TIME', 'EVERY_CYCLE']);

export const createFeePlanSchema = z
  .object({
    name: z.string().min(2).max(80),
    amount: z.coerce.number().positive(),
    durationMonths: z.coerce.number().int().min(1).max(60),
    description: z.string().max(300).optional()
  })
  .strict();

export const updateFeePlanSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    amount: z.coerce.number().positive().optional(),
    durationMonths: z.coerce.number().int().min(1).max(60).optional(),
    description: z.string().max(300).nullable().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required for update'
  });

export const updateFeePlanParamsSchema = z.object({
  planId: z.string().regex(objectIdRegex, 'Invalid planId')
});

export const assignFeePlanSchema = z
  .object({
    studentId: z.string().regex(objectIdRegex, 'Invalid studentId'),
    feePlanId: z.string().regex(objectIdRegex, 'Invalid feePlanId'),
    startDate: z.string().datetime({ offset: true }).or(z.string().date()),
    discountType: discountTypeSchema.optional(),
    discountValue: z.coerce.number().min(0).optional(),
    discountScope: discountScopeSchema.optional()
  })
  .refine(
    (value) =>
      value.discountType === undefined ||
      value.discountType === 'NONE' ||
      (value.discountValue ?? 0) > 0,
    { message: 'Discount value must be greater than 0', path: ['discountValue'] }
  )
  .strict();

export const updateStudentFeeParamsSchema = z.object({
  studentId: z.string().regex(objectIdRegex, 'Invalid studentId')
});

export const updateStudentFeeSchema = z
  .object({
    feePlanId: z.string().regex(objectIdRegex, 'Invalid feePlanId').optional(),
    startDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
    discountType: discountTypeSchema.optional(),
    discountValue: z.coerce.number().min(0).optional(),
    discountScope: discountScopeSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required for update'
  })
  .refine(
    (value) =>
      value.discountType === undefined ||
      value.discountType === 'NONE' ||
      (value.discountValue ?? 0) > 0,
    { message: 'Discount value must be greater than 0', path: ['discountValue'] }
  )
  .strict();

export const studentFeeStatusQuerySchema = z.object({
  studentId: z.string().regex(objectIdRegex, 'Invalid studentId'),
  asOfDate: z.string().datetime({ offset: true }).or(z.string().date()).optional()
});

export const recordPaymentSchema = z
  .object({
    studentId: z.string().regex(objectIdRegex, 'Invalid studentId'),
    amountPaid: z.coerce.number().positive(),
    paymentDate: z.string().datetime({ offset: true }).or(z.string().date()),
    dueDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
    month: z.string().trim().min(3).max(20),
    paymentMode: paymentModeSchema,
    transactionId: z.string().trim().max(120).optional(),
    referenceNote: z.string().max(300).optional(),
    createPendingIfMissing: z.boolean().optional()
  })
  .strict();

export const paymentHistoryQuerySchema = z.object({
  studentId: z.string().regex(objectIdRegex, 'Invalid studentId').optional(),
  status: paymentStatusSchema.optional(),
  classId: z.string().regex(objectIdRegex, 'Invalid classId').optional(),
  dueInDays: z.coerce.number().int().min(1).max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

export const pendingFeesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(120).optional(),
  asOfDate: z.string().datetime({ offset: true }).or(z.string().date()).optional()
});

export const reminderSchema = z
  .object({
    channel: z.enum(['whatsapp', 'email']),
    status: paymentStatusSchema.optional(),
    classId: z.string().regex(objectIdRegex, 'Invalid classId').optional(),
    dueInDays: z.coerce.number().int().min(1).max(60).optional()
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
