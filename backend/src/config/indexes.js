import { logger } from './logger.js';
import { Student } from '../models/student.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Payment } from '../models/payment.model.js';
import { RegistrationPayment } from '../models/registrationPayment.model.js';
import { Notification } from '../models/notification.model.js';
import { Tenant } from '../models/tenant.model.js';
import { User } from '../models/user.model.js';
import { AutomationLog } from '../modules/automations/automation.model.js';
import { TenantIntegration } from '../modules/integrations/integration.model.js';

const INDEX_MODELS = [
  { name: 'Student', model: Student },
  { name: 'Attendance', model: Attendance },
  { name: 'Payment', model: Payment },
  { name: 'RegistrationPayment', model: RegistrationPayment },
  { name: 'Notification', model: Notification },
  { name: 'AutomationLog', model: AutomationLog },
  { name: 'TenantIntegration', model: TenantIntegration },
  { name: 'Tenant', model: Tenant },
  { name: 'User', model: User }
];

const ensureRazorpayPaymentIndexShape = async (model) => {
  try {
    const indexes = await model.collection.indexes();
    const staleIndexes = indexes.filter(
      (index) =>
        index?.key?.razorpayPaymentId === 1 &&
        index.unique &&
        !index.partialFilterExpression
    );

    for (const index of staleIndexes) {
      await model.collection.dropIndex(index.name);
    }
  } catch (error) {
    if (error?.code !== 26) {
      throw error;
    }
  }
};

export const ensureIndexes = async () => {
  const results = await Promise.allSettled(
    INDEX_MODELS.map(async ({ name, model }) => {
      if (name === 'Payment' || name === 'RegistrationPayment') {
        await ensureRazorpayPaymentIndexShape(model);
      }
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
