import { Student } from '../../models/student.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { Batch } from '../../models/batch.model.js';
import { Payment } from '../../models/payment.model.js';
import { Subscription } from '../../models/subscription.model.js';
import { StudentFee } from '../../models/studentFee.model.js';

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
  },

  sumPaidThisMonth(tenantId, monthStart, nextMonthStart) {
    return Payment.aggregate([
      { $match: { tenantId, paymentDate: { $gte: monthStart, $lt: nextMonthStart }, status: 'PAID' } },
      { $group: { _id: null, totalAmount: { $sum: '$amountPaid' } } }
    ]);
  },

  countOverdueStudents(tenantId) {
    return Payment.aggregate([
      { $match: { tenantId, status: 'OVERDUE' } },
      { $group: { _id: '$studentId' } },
      { $count: 'total' }
    ]);
  },

  listActiveStudentFees(tenantId) {
    return StudentFee.find({ tenantId, status: 'active' })
      .populate({ path: 'feePlanId', select: '_id name amount durationMonths', options: { lean: true } })
      .lean();
  },

  sumPaymentsSinceStart(tenantId, studentId, startDate) {
    return Payment.aggregate([
      {
        $match: {
          tenantId,
          studentId,
          paymentDate: { $gte: startDate }
        }
      },
      { $group: { _id: null, totalAmount: { $sum: '$amountPaid' } } }
    ]);
  }
};

