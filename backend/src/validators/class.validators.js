import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createClassSchema = z
  .object({
    name: z.string().min(2).max(120),
    section: z.string().min(1).max(50)
  })
  .strict();

export const classIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid class id')
});

export const assignTeacherSchema = z
  .object({
    teacherId: z.string().regex(objectIdRegex, 'Invalid teacherId')
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
