import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const phoneRegex = /^[0-9+\-()\s]{7,20}$/;

export const createTeacherSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    phone: z.string().regex(phoneRegex, 'Invalid phone')
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
