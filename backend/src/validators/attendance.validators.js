import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const objectIdRegex = /^[a-f0-9]{24}$/i;

export const markAttendanceSchema = z
  .object({
    batchId: z.string().regex(objectIdRegex, 'Invalid batchId'),
    date: z.string().datetime({ offset: true }).or(z.string().date()),
    records: z
      .array(
        z
          .object({
            studentId: z.string().regex(objectIdRegex, 'Invalid studentId'),
            status: z.enum(['present', 'absent'])
          })
          .strict()
      )
      .min(1)
      .max(1000)
  })
  .strict();

export const attendanceByDateQuerySchema = z.object({
  date: z.string().datetime({ offset: true }).or(z.string().date()),
  batchId: z.string().regex(objectIdRegex, 'Invalid batchId').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

export const attendanceStatsQuerySchema = z.object({
  studentId: z.string().regex(objectIdRegex, 'Invalid studentId'),
  fromDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  toDate: z.string().datetime({ offset: true }).or(z.string().date()).optional()
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
