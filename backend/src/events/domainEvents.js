import { EventEmitter } from 'node:events';

export const DOMAIN_EVENTS = {
  PAYMENT_PENDING: 'payment.pending',
  ATTENDANCE_ABSENT: 'attendance.absent',
  BROADCAST_REQUESTED: 'broadcast.requested'
};

export const domainEvents = new EventEmitter();
domainEvents.setMaxListeners(100);
