import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const objectIdRegex = /^[a-f0-9]{24}$/i;

export const markAttendanceSchema = z
  .object({
    batchId: z.string().regex(objectIdRegex, 'Invalid batchId').optional(),
    classId: z.string().regex(objectIdRegex, 'Invalid classId').optional(),
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
  .strict()
  .superRefine((value, ctx) => {
    if (!value.batchId && !value.classId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['batchId'],
        message: 'Either batchId or classId is required'
      });
    }

    if (value.batchId && value.classId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['classId'],
        message: 'Provide only one of batchId or classId'
      });
    }
  });

export const attendanceByDateQuerySchema = z
  .object({
    date: z.string().datetime({ offset: true }).or(z.string().date()),
    batchId: z.string().regex(objectIdRegex, 'Invalid batchId').optional(),
    classId: z.string().regex(objectIdRegex, 'Invalid classId').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50)
  })
  .superRefine((value, ctx) => {
    if (value.batchId && value.classId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['classId'],
        message: 'Provide only one of batchId or classId'
      });
    }
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
