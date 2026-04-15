import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const dayCodeSchema = z.enum(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
const timeValueSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:mm format');

export const createClassSchema = z
  .object({
    name: z.string().min(1).max(120),
    section: z.string().max(50).optional().default(''),
    scheduleDays: z.array(dayCodeSchema).max(7).optional().default([]),
    startTime: z.union([timeValueSchema, z.literal('')]).optional().default(''),
    endTime: z.union([timeValueSchema, z.literal('')]).optional().default('')
  })
  .superRefine((payload, ctx) => {
    const hasScheduleData =
      payload.scheduleDays.length > 0 || Boolean(payload.startTime) || Boolean(payload.endTime);

    if (!hasScheduleData) {
      return;
    }

    if (payload.scheduleDays.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduleDays'],
        message: 'Select at least one class day'
      });
    }

    if (!payload.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startTime'],
        message: 'Start time is required when schedule is set'
      });
    }

    if (!payload.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'End time is required when schedule is set'
      });
    }
  })
  .strict();

export const updateClassSchema = createClassSchema;

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
