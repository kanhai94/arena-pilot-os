import { Tenant } from '../../models/tenant.model.js';

export const tenantMetricsRepository = {
  resetMonthlyCountersIfNeeded(tenantId, monthKey) {
    return Tenant.updateOne(
      { _id: tenantId, metricsMonth: { $ne: monthKey } },
      {
        $set: {
          metricsMonth: monthKey,
          attendanceCountThisMonth: 0,
          paymentsRecordedThisMonth: 0,
          remindersSentThisMonth: 0
        }
      }
    );
  },

  markLogin(tenantId, date) {
    return Tenant.updateOne(
      { _id: tenantId },
      {
        $set: {
          lastLoginAt: date,
          lastActivityAt: date
        }
      }
    );
  },

  touchActivity(tenantId, date) {
    return Tenant.updateOne(
      { _id: tenantId },
      {
        $set: {
          lastActivityAt: date
        }
      }
    );
  },

  adjustTotalStudents(tenantId, delta, date) {
    return Tenant.updateOne(
      { _id: tenantId },
      [
        {
          $set: {
            totalStudents: {
              $max: [0, { $add: [{ $ifNull: ['$totalStudents', 0] }, delta] }]
            },
            currentStudentCount: {
              $max: [0, { $add: [{ $ifNull: ['$currentStudentCount', 0] }, delta] }]
            },
            lastActivityAt: date
          }
        }
      ]
    );
  },

  incrementAttendanceCount(tenantId, count, date) {
    return Tenant.updateOne(
      { _id: tenantId },
      {
        $inc: { attendanceCountThisMonth: count },
        $set: { lastActivityAt: date }
      }
    );
  },

  incrementPaymentsCount(tenantId, count, date) {
    return Tenant.updateOne(
      { _id: tenantId },
      {
        $inc: { paymentsRecordedThisMonth: count },
        $set: { lastActivityAt: date }
      }
    );
  },

  incrementRemindersCount(tenantId, count, date) {
    return Tenant.updateOne(
      { _id: tenantId },
      {
        $inc: { remindersSentThisMonth: count },
        $set: { lastActivityAt: date }
      }
    );
  }
};
