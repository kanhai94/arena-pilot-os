import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const objectIdRegex = /^[a-f0-9]{24}$/i;
const phoneRegex = /^[0-9+\-()\s]{7,20}$/;

const optionalObjectId = z.string().regex(objectIdRegex, 'Invalid ObjectId').optional().nullable();

export const createStudentSchema = z
  .object({
    name: z.string().min(2).max(120),
    age: z.coerce.number().int().min(3).max(100),
    gender: z.enum(['male', 'female', 'other']),
    parentName: z.string().min(2).max(120),
    parentPhone: z.string().regex(phoneRegex, 'Invalid parentPhone'),
    email: z.string().email().optional(),
    batchId: optionalObjectId,
    feeStatus: z.enum(['paid', 'pending']).default('pending')
  })
  .strict();

export const updateStudentSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    age: z.coerce.number().int().min(3).max(100).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    parentName: z.string().min(2).max(120).optional(),
    parentPhone: z.string().regex(phoneRegex, 'Invalid parentPhone').optional(),
    email: z.string().email().nullable().optional(),
    batchId: optionalObjectId,
    feeStatus: z.enum(['paid', 'pending']).optional()
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, 'At least one field is required for update');

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'inactive']).optional()
});

export const studentIdParamSchema = z.object({
  studentId: z.string().regex(objectIdRegex, 'Invalid studentId')
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
