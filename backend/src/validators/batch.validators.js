import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const objectIdRegex = /^[a-f0-9]{24}$/i;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const createBatchSchema = z
  .object({
    name: z.string().min(2).max(120),
    centerName: z.string().min(2).max(120).default('Main Center'),
    feePlanId: z.string().regex(objectIdRegex, 'Invalid feePlanId').optional().nullable(),
    sportType: z.string().min(2).max(80),
    coachId: z.string().regex(objectIdRegex, 'Invalid coachId').optional().nullable(),
    scheduleDays: z.array(z.enum(weekDays)).min(1),
    startTime: z.string().regex(timeRegex, 'Invalid startTime format, expected HH:mm'),
    endTime: z.string().regex(timeRegex, 'Invalid endTime format, expected HH:mm'),
    capacity: z.coerce.number().int().min(1).max(1000)
  })
  .strict();

export const updateBatchSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    centerName: z.string().min(2).max(120).optional(),
    feePlanId: z.string().regex(objectIdRegex, 'Invalid feePlanId').optional().nullable(),
    sportType: z.string().min(2).max(80).optional(),
    coachId: z.string().regex(objectIdRegex, 'Invalid coachId').optional().nullable(),
    scheduleDays: z.array(z.enum(weekDays)).min(1).optional(),
    startTime: z.string().regex(timeRegex, 'Invalid startTime format, expected HH:mm').optional(),
    endTime: z.string().regex(timeRegex, 'Invalid endTime format, expected HH:mm').optional(),
    capacity: z.coerce.number().int().min(1).max(1000).optional(),
    status: z.enum(['active', 'inactive']).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required for update');

export const batchIdParamSchema = z.object({
  batchId: z.string().regex(objectIdRegex, 'Invalid batchId')
});

export const listBatchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'inactive']).optional(),
  sportType: z.string().min(2).max(80).optional(),
  centerName: z.string().min(2).max(120).optional()
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
