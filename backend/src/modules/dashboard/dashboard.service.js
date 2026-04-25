import { TenantContext } from '../../core/context/tenantContext.js';
import { computeFeeMetrics } from '../fees/fee.utils.js';

const toDayRange = (baseDate = new Date()) => {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const toMonthRange = (baseDate = new Date()) => {
  const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  const nextMonthStart = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  nextMonthStart.setHours(0, 0, 0, 0);

  return { monthStart, nextMonthStart };
};

const weekDayToken = (baseDate = new Date()) => {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[baseDate.getDay()];
};

export const createDashboardService = (repository) => {
  const resolveTenantId = () => TenantContext.requireTenantId();

  return {
    async getOverview() {
      const tenantId = resolveTenantId();
      const now = new Date();
      const { start: dayStart, end: dayEnd } = toDayRange(now);
      const { monthStart, nextMonthStart } = toMonthRange(now);

      const sevenDaysLater = new Date(dayStart);
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
      sevenDaysLater.setHours(23, 59, 59, 999);

      const [
        activeStudents,
        newStudentsThisMonth,
        scheduledClassesToday,
        attendanceMarkedToday,
        feesCollectedRows,
        pendingFeeCount,
        upcomingRenewals,
        activeBatches
      ] = await Promise.all([
        repository.countActiveStudents(tenantId),
        repository.countNewStudentsThisMonth(tenantId, monthStart, nextMonthStart),
        repository.countScheduledClassesToday(tenantId, weekDayToken(now)),
        repository.countAttendanceMarkedToday(tenantId, dayStart, dayEnd),
        repository.sumFeesCollectedToday(tenantId, dayStart, dayEnd),
        repository.countPendingFeeSubscriptions(tenantId),
        repository.countUpcomingRenewals(tenantId, dayStart, sevenDaysLater),
        repository.countActiveBatches(tenantId)
      ]);

      const pendingAttendanceRaw = scheduledClassesToday - attendanceMarkedToday;
      const pendingAttendance = pendingAttendanceRaw > 0 ? pendingAttendanceRaw : 0;
      const feesCollectedToday = feesCollectedRows?.[0]?.totalAmount ?? 0;
      const attendanceRate =
        scheduledClassesToday > 0
          ? Number(((attendanceMarkedToday / scheduledClassesToday) * 100).toFixed(2))
          : 0;

      return {
        activeStudents,
        newStudentsThisMonth,
        scheduledClassesToday,
        attendanceMarkedToday,
        pendingAttendance,
        feesCollectedToday,
        pendingFeeCount,
        upcomingRenewals,
        attendanceRate,
        activeBatches
      };
    },

    async getFeeSummary() {
      const tenantId = resolveTenantId();
      const now = new Date();
      const { monthStart, nextMonthStart } = toMonthRange(now);
      const activeStudentFees = await repository.listActiveStudentFees(tenantId);
      const paymentTotals = await Promise.all(
        activeStudentFees.map((item) => repository.sumPaymentsSinceStart(tenantId, item.studentId, item.startDate))
      );

      let totalPendingRows = 0;
      const totalPendingFees = activeStudentFees.reduce((sum, item, index) => {
        const feePlan = item.feePlanId;
        if (!feePlan) return sum;
        const totalPaid = paymentTotals[index]?.[0]?.totalAmount || 0;
        const metrics = computeFeeMetrics({
          startDate: item.startDate,
          nextDueDate: item.nextDueDate,
          totalAmount: item.totalAmount,
          durationMonths: feePlan.durationMonths,
          totalPaid,
          asOfDate: now
        });
        const pendingCycles = feePlan.amount > 0 ? Math.max(0, Math.ceil(metrics.pendingTillDate / feePlan.amount)) : 0;
        totalPendingRows += pendingCycles;
        return sum + metrics.pendingTillDate;
      }, 0);

      const [paidThisMonthRows, overdueStudentsRows] = await Promise.all([
        repository.sumPaidThisMonth(tenantId, monthStart, nextMonthStart),
        repository.countOverdueStudents(tenantId)
      ]);

      return {
        totalPendingFees,
        paidThisMonth: paidThisMonthRows?.[0]?.totalAmount || 0,
        overdueStudentsCount: overdueStudentsRows?.[0]?.total || 0,
        totalPendingRows
      };
    }
  };
};

