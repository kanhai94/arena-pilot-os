import { DOMAIN_EVENTS, domainEvents } from '../../events/domainEvents.js';
import { notificationService } from './notification.container.js';
import { logger } from '../../config/logger.js';

let isRegistered = false;

export const registerNotificationEventHandlers = () => {
  if (isRegistered) {
    return;
  }

  isRegistered = true;

  domainEvents.on(DOMAIN_EVENTS.PAYMENT_PENDING, async (payload) => {
    try {
      await notificationService.handlePaymentPendingEvent(payload);
    } catch (error) {
      logger.error({ err: error, payload }, 'Failed to handle PAYMENT_PENDING event');
    }
  });

  domainEvents.on(DOMAIN_EVENTS.ATTENDANCE_ABSENT, async (payload) => {
    try {
      await notificationService.handleAttendanceAbsentEvent(payload);
    } catch (error) {
      logger.error({ err: error, payload }, 'Failed to handle ATTENDANCE_ABSENT event');
    }
  });

  domainEvents.on(DOMAIN_EVENTS.BROADCAST_REQUESTED, async (payload) => {
    try {
      await notificationService.handleBroadcastEvent(payload);
    } catch (error) {
      logger.error({ err: error, payload }, 'Failed to handle BROADCAST_REQUESTED event');
    }
  });
};
