import { Student } from '../../models/student.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { Batch } from '../../models/batch.model.js';
import { Payment } from '../../models/payment.model.js';
import { Subscription } from '../../models/subscription.model.js';

export const dashboardRepository = {
  countActiveStudents(tenantId) {
    return Student.countDocuments({
      tenantId,
      status: { $in: ['active', 'ACTIVE'] }
    });
  },

  countNewStudentsThisMonth(tenantId, fromDate, toDate) {
    return Student.countDocuments({
      tenantId,
      createdAt: { $gte: fromDate, $lt: toDate }
    });
  },

  countScheduledClassesToday(tenantId, dayToken) {
    // ClassSchedule collection does not exist in this codebase; batches + scheduleDays model is used.
    return Batch.countDocuments({
      tenantId,
      status: 'active',
      scheduleDays: dayToken
    });
  },

  countAttendanceMarkedToday(tenantId, dayStart, dayEnd) {
    return Attendance.countDocuments({
      tenantId,
      date: { $gte: dayStart, $lt: dayEnd }
    });
  },

  sumFeesCollectedToday(tenantId, dayStart, dayEnd) {
    return Payment.aggregate([
      { $match: { tenantId, createdAt: { $gte: dayStart, $lt: dayEnd } } },
      { $group: { _id: null, totalAmount: { $sum: '$amountPaid' } } }
    ]);
  },

  countPendingFeeSubscriptions(tenantId) {
    return Subscription.countDocuments({
      tenantId,
      status: { $in: ['PENDING', 'pending'] }
    });
  },

  countUpcomingRenewals(tenantId, todayStart, nextSevenDaysEnd) {
    return Subscription.countDocuments({
      tenantId,
      status: { $in: ['active', 'trial'] },
      endDate: { $gte: todayStart, $lte: nextSevenDaysEnd }
    });
  },

  countActiveBatches(tenantId) {
    return Batch.countDocuments({ tenantId, status: 'active' });
  }
};

