import { z } from 'zod';
import { AppError } from '../errors/appError.js';

const objectIdRegex = /^[a-f0-9]{24}$/i;

export const triggerFeeReminderSchema = z
  .object({
    studentId: z.string().regex(objectIdRegex, 'Invalid studentId').optional(),
    asOfDate: z.string().datetime({ offset: true }).or(z.string().date()).optional()
  })
  .strict();

export const sendBroadcastSchema = z
  .object({
    messageContent: z.string().min(3).max(1000),
    studentIds: z.array(z.string().regex(objectIdRegex, 'Invalid studentId')).min(1).optional()
  })
  .strict();

export const notificationLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['queued', 'sent', 'failed']).optional(),
  messageType: z.enum(['feeReminder', 'absence', 'broadcast']).optional()
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
