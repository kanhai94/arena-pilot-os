import { z } from 'zod';

const stringArray = z.array(z.string().min(1)).optional().default([]);

export const automationPreviewFeeSchema = z.object({
  dueInDays: z.coerce.number().int().min(1).max(365),
  classIds: stringArray
});

export const automationPreviewAbsenceSchema = z.object({
  mode: z.enum(['today', 'streak']).default('today'),
  days: z.coerce.number().int().min(1).max(30).optional(),
  classIds: stringArray
});

export const automationPreviewBroadcastSchema = z.object({
  studentIds: stringArray
});

export const automationSendSchema = z.object({
  automationType: z.enum(['feeReminder', 'absenceAlert', 'broadcast']),
  channel: z.enum(['email', 'whatsapp', 'both']),
  messageTemplate: z.string().min(3),
  studentIds: stringArray,
  dueInDays: z.coerce.number().int().min(1).max(365).optional(),
  absenceMode: z.enum(['today', 'streak']).optional(),
  absenceDays: z.coerce.number().int().min(1).max(30).optional(),
  classIds: stringArray
});

export const automationLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});
