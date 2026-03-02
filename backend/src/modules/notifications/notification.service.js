import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { computeFeeMetrics } from '../fees/fee.utils.js';
import { normalizeToUTCDate } from '../fees/fee.utils.js';
import { domainEvents, DOMAIN_EVENTS } from '../../events/domainEvents.js';

export const createNotificationService = ({ repository, enqueueJob, whatsappAdapter }) => {
  const queueNotification = async ({ tenantId, studentId = null, phoneNumber, messageType, messageContent }) => {
    const notification = await repository.createNotification({
      tenantId,
      studentId,
      phoneNumber,
      messageType,
      messageContent,
      status: 'queued'
    });

    await enqueueJob(String(notification._id));

    return notification;
  };

  return {
    async triggerFeeReminderEvent(tenantId, payload = {}) {
      const asOfDate = payload.asOfDate ? normalizeToUTCDate(payload.asOfDate) : new Date();
      const candidates = await repository.getPendingFeeCandidates(tenantId, payload.studentId);

      let triggered = 0;

      for (const candidate of candidates) {
        const metrics = computeFeeMetrics({
          startDate: candidate.startDate,
          nextDueDate: candidate.nextDueDate,
          totalAmount: candidate.totalAmount,
          durationMonths: candidate.feePlan.durationMonths,
          totalPaid: candidate.totalPaid || 0,
          asOfDate
        });

        if (metrics.pendingTillDate <= 0) {
          continue;
        }

        domainEvents.emit(DOMAIN_EVENTS.PAYMENT_PENDING, {
          tenantId,
          studentId: String(candidate.student._id),
          studentName: candidate.student.name,
          phoneNumber: candidate.student.parentPhone,
          pendingAmount: metrics.pendingTillDate,
          dueDate: candidate.nextDueDate,
          feePlanName: candidate.feePlan.name
        });

        triggered += 1;
      }

      return { triggered };
    },

    async sendBroadcastEvent(tenantId, payload) {
      const recipients = payload.studentIds
        ? await repository.getStudentsByIds(tenantId, payload.studentIds)
        : await repository.getAllActiveStudents(tenantId);

      for (const recipient of recipients) {
        domainEvents.emit(DOMAIN_EVENTS.BROADCAST_REQUESTED, {
          tenantId,
          studentId: String(recipient._id),
          phoneNumber: recipient.parentPhone,
          messageContent: payload.messageContent
        });
      }

      return {
        triggered: recipients.length
      };
    },

    async getNotificationLogs(tenantId, query) {
      const { items, total } = await repository.getNotificationLogs({
        tenantId,
        page: query.page,
        limit: query.limit,
        status: query.status,
        messageType: query.messageType
      });

      return {
        items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit)
        }
      };
    },

    async processQueuedNotification(notificationId) {
      const notification = await repository.findNotificationById(notificationId);
      if (!notification) {
        throw new AppError('Notification not found', StatusCodes.NOT_FOUND);
      }

      if (notification.status === 'sent') {
        return notification;
      }

      try {
        await whatsappAdapter.sendMessage(notification.phoneNumber, notification.messageContent);
        return repository.markNotificationSent(notificationId);
      } catch (error) {
        await repository.markNotificationFailed(notificationId);
        throw error;
      }
    },

    async handlePaymentPendingEvent(payload) {
      const messageContent = `Dear Parent, fee reminder for ${payload.studentName}. Pending amount: ${payload.pendingAmount}. Due date: ${new Date(payload.dueDate).toISOString().slice(0, 10)}.`;
      return queueNotification({
        tenantId: payload.tenantId,
        studentId: payload.studentId,
        phoneNumber: payload.phoneNumber,
        messageType: 'feeReminder',
        messageContent
      });
    },

    async handleAttendanceAbsentEvent(payload) {
      const jobs = payload.absentStudents.map((student) => {
        const messageContent = `Attendance alert: ${student.name} was marked absent on ${payload.date}.`;
        return queueNotification({
          tenantId: payload.tenantId,
          studentId: student.studentId,
          phoneNumber: student.phoneNumber,
          messageType: 'absence',
          messageContent
        });
      });

      return Promise.all(jobs);
    },

    async handleBroadcastEvent(payload) {
      return queueNotification({
        tenantId: payload.tenantId,
        studentId: payload.studentId,
        phoneNumber: payload.phoneNumber,
        messageType: 'broadcast',
        messageContent: payload.messageContent
      });
    }
  };
};
