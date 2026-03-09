import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { computeFeeMetrics, normalizeToUTCDate } from '../fees/fee.utils.js';
import { TenantContext } from '../../core/context/tenantContext.js';
import { sendAutomationEmail } from '../../adapters/email.adapter.js';

const addDaysUTC = (dateValue, days) => {
  const base = new Date(dateValue);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days));
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const renderTemplate = (template, variables) => {
  return Object.entries(variables).reduce((acc, [key, val]) => {
    const safeVal = val === null || val === undefined ? '' : String(val);
    return acc.replaceAll(`{{${key}}}`, safeVal);
  }, template);
};

export const createAutomationService = ({ repository, notificationService }) => {
  const resolveTenantId = () => TenantContext.requireTenantId();

  const buildFeeReminderRows = async ({ dueInDays, studentIds = [], classIds = [] }) => {
    const tenantId = resolveTenantId();
    const today = normalizeToUTCDate(new Date());
    const dueByDate = addDaysUTC(today, dueInDays);

    const rows = await repository.getFeeReminderCandidates({
      tenantId,
      dueByDate,
      studentIds,
      batchIds: classIds
    });

    const candidates = [];

    for (const row of rows) {
      const metrics = computeFeeMetrics({
        startDate: row.startDate,
        nextDueDate: row.nextDueDate,
        totalAmount: row.totalAmount,
        durationMonths: row.feePlan.durationMonths,
        totalPaid: row.totalPaid || 0,
        asOfDate: today
      });

      if (metrics.pendingTillDate <= 0) {
        continue;
      }

      const batch = Array.isArray(row.batch) ? row.batch[0] : row.batch;
      candidates.push({
        studentId: String(row.student._id),
        name: row.student.name,
        phone: row.student.parentPhone,
        email: row.student.email || '',
        class: batch?.name || 'Unassigned',
        dueAmount: metrics.pendingTillDate,
        dueDate: row.nextDueDate
      });
    }

    return candidates;
  };

  const buildAbsenceRows = async ({ mode, days, classIds = [] }) => {
    const tenantId = resolveTenantId();
    const today = normalizeToUTCDate(new Date());
    const dateRange = mode === 'today'
      ? today
      : {
          from: addDaysUTC(today, -(days - 1)),
          to: today
        };

    const rows = await repository.getAbsenceCandidates({
      tenantId,
      mode,
      days,
      date: dateRange,
      batchIds: classIds
    });

    return rows.map((row) => {
      const batch = Array.isArray(row.batch) ? row.batch[0] : row.batch;
      return {
        studentId: String(row.student._id),
        name: row.student.name,
        phone: row.student.parentPhone,
        email: row.student.email || '',
        class: batch?.name || 'Unassigned',
        lastAttendanceDate: row.lastAttendanceDate
      };
    });
  };

  const sendWhatsapp = async ({ tenantId, studentId, phoneNumber, messageType, messageContent }) => {
    if (!phoneNumber) return { sent: false };
    await notificationService.sendCustomNotification({ tenantId, studentId, phoneNumber, messageType, messageContent });
    return { sent: true };
  };

  const sendEmail = async ({ to, subject, text, html }) => {
    if (!to) return { sent: false };
    return sendAutomationEmail({ to, subject, text, html });
  };

  return {
    async previewFeeReminder({ dueInDays, classIds = [] }) {
      if (!dueInDays || Number.isNaN(Number(dueInDays))) {
        throw new AppError('Due in days is required', StatusCodes.BAD_REQUEST);
      }
      const candidates = await buildFeeReminderRows({ dueInDays: Number(dueInDays), classIds });
      return { items: candidates, total: candidates.length };
    },

    async previewAbsenceAlert({ mode, days, classIds = [] }) {
      if (mode !== 'today' && mode !== 'streak') {
        throw new AppError('Invalid absence mode', StatusCodes.BAD_REQUEST);
      }
      if (mode === 'streak' && (!days || Number(days) < 1)) {
        throw new AppError('Days is required for absence streak', StatusCodes.BAD_REQUEST);
      }
      const candidates = await buildAbsenceRows({ mode, days: Number(days || 1), classIds });
      return { items: candidates, total: candidates.length };
    },

    async previewBroadcast({ studentIds = [] }) {
      const tenantId = resolveTenantId();
      const students = await repository.listActiveStudents(tenantId, studentIds);
      const batches = await repository.getBatchesByIds(
        tenantId,
        students.map((student) => student.batchId).filter(Boolean)
      );
      const batchMap = new Map(batches.map((batch) => [String(batch._id), batch]));

      const items = students.map((student) => {
        const batch = student.batchId ? batchMap.get(String(student.batchId)) : null;
        return {
          studentId: String(student._id),
          name: student.name,
          phone: student.parentPhone,
          email: student.email || '',
          class: batch?.name || 'Unassigned'
        };
      });

      return { items, total: items.length };
    },

    async sendAutomation(payload) {
      const tenantId = resolveTenantId();
      const {
        automationType,
        channel,
        messageTemplate,
        dueInDays,
        absenceMode,
        absenceDays,
        classIds = [],
        studentIds = []
      } = payload;

      if (!automationType || !channel || !messageTemplate) {
        throw new AppError('Automation type, channel, and message are required', StatusCodes.BAD_REQUEST);
      }

      const academyName = await repository.getTenantName(tenantId);
      let targets = [];

      if (automationType === 'feeReminder') {
        targets = await buildFeeReminderRows({
          dueInDays: Number(dueInDays || 1),
          studentIds,
          classIds
        });
      } else if (automationType === 'absenceAlert') {
        targets = await buildAbsenceRows({
          mode: absenceMode || 'today',
          days: Number(absenceDays || 1),
          classIds
        });
        if (studentIds.length > 0) {
          const allow = new Set(studentIds.map(String));
          targets = targets.filter((row) => allow.has(row.studentId));
        }
      } else if (automationType === 'broadcast') {
        const preview = await this.previewBroadcast({ studentIds });
        targets = preview.items;
      } else {
        throw new AppError('Unsupported automation type', StatusCodes.BAD_REQUEST);
      }

      if (targets.length === 0) {
        throw new AppError('No students matched the automation filters', StatusCodes.BAD_REQUEST);
      }

      const results = {
        total: targets.length,
        whatsapp: 0,
        email: 0,
        failed: 0
      };

      for (const student of targets) {
        const variables = {
          studentName: student.name,
          amount: student.dueAmount ?? '',
          dueDate: formatDate(student.dueDate),
          academyName
        };
        const message = renderTemplate(messageTemplate, variables);

        if (channel === 'whatsapp' || channel === 'both') {
          try {
            await sendWhatsapp({
              tenantId,
              studentId: student.studentId,
              phoneNumber: student.phone,
              messageType: automationType === 'broadcast' ? 'broadcast' : automationType === 'absenceAlert' ? 'absence' : 'feeReminder',
              messageContent: message
            });
            results.whatsapp += 1;
          } catch (error) {
            results.failed += 1;
          }
        }

        if (channel === 'email' || channel === 'both') {
          try {
            const subject = `${academyName} update`;
            const text = message;
            const html = `<div style="font-family: Arial, sans-serif; color: #0f172a;">${message.replaceAll('\n', '<br/>')}</div>`;
            const sent = await sendEmail({ to: student.email, subject, text, html });
            if (sent?.sent) {
              results.email += 1;
            } else {
              results.failed += 1;
            }
          } catch (error) {
            results.failed += 1;
          }
        }
      }

      const status = results.failed > 0 ? 'failed' : 'sent';
      await repository.createAutomationLog({
        tenantId,
        automationType,
        studentsTargeted: targets.length,
        channel,
        message: messageTemplate,
        status
      });

      return { ...results, status };
    },

    async getAutomationLogs(page, limit) {
      const tenantId = resolveTenantId();
      const { items, total } = await repository.listAutomationLogs({ tenantId, page, limit });
      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    }
  };
};
