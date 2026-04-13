import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createSubjectSchema = z
  .object({
    name: z.string().min(2).max(120),
    classId: z.string().regex(objectIdRegex, 'Invalid classId'),
    teacherId: z.string().regex(objectIdRegex, 'Invalid teacherId').optional().nullable(),
    status: z.enum(['active', 'inactive']).default('active')
  })
  .strict();

export const updateSubjectSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    classId: z.string().regex(objectIdRegex, 'Invalid classId').optional(),
    teacherId: z.string().regex(objectIdRegex, 'Invalid teacherId').optional().nullable(),
    status: z.enum(['active', 'inactive']).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const subjectIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid subject id')
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
