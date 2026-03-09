import { logger } from './logger.js';
import { Student } from '../models/student.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Payment } from '../models/payment.model.js';
import { Notification } from '../models/notification.model.js';
import { Tenant } from '../models/tenant.model.js';
import { User } from '../models/user.model.js';
import { AutomationLog } from '../modules/automations/automation.model.js';

const INDEX_MODELS = [
  { name: 'Student', model: Student },
  { name: 'Attendance', model: Attendance },
  { name: 'Payment', model: Payment },
  { name: 'Notification', model: Notification },
  { name: 'AutomationLog', model: AutomationLog },
  { name: 'Tenant', model: Tenant },
  { name: 'User', model: User }
];

export const ensureIndexes = async () => {
  const results = await Promise.allSettled(
    INDEX_MODELS.map(async ({ name, model }) => {
      await model.createIndexes();
      return name;
    })
  );

  const failed = results.filter((result) => result.status === 'rejected');
  const passed = results.filter((result) => result.status === 'fulfilled').length;

  logger.info(
    {
      tenantId: null,
      passed,
      failed: failed.length
    },
    'MongoDB index initialization completed'
  );

  failed.forEach((result) => {
    logger.error(
      {
        tenantId: null,
        err: result.reason
      },
      'MongoDB index initialization failed for one model'
    );
  });
};
