export const createTenantMetricsService = (repository) => {
  const getMonthKey = (date = new Date()) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const ensureMonthContext = async (tenantId, date = new Date()) => {
    await repository.resetMonthlyCountersIfNeeded(tenantId, getMonthKey(date));
  };

  return {
    async markLogin(tenantId) {
      const now = new Date();
      await ensureMonthContext(tenantId, now);
      await repository.markLogin(tenantId, now);
    },

    async touchActivity(tenantId) {
      await repository.touchActivity(tenantId, new Date());
    },

    async adjustTotalStudents(tenantId, delta) {
      const now = new Date();
      await ensureMonthContext(tenantId, now);
      await repository.adjustTotalStudents(tenantId, delta, now);
    },

    async incrementAttendanceCountThisMonth(tenantId, count = 1) {
      const safeCount = Number(count) || 0;
      if (safeCount <= 0) return;
      const now = new Date();
      await ensureMonthContext(tenantId, now);
      await repository.incrementAttendanceCount(tenantId, safeCount, now);
    },

    async incrementPaymentsRecordedThisMonth(tenantId, count = 1) {
      const safeCount = Number(count) || 0;
      if (safeCount <= 0) return;
      const now = new Date();
      await ensureMonthContext(tenantId, now);
      await repository.incrementPaymentsCount(tenantId, safeCount, now);
    },

    async incrementRemindersSentThisMonth(tenantId, count = 1) {
      const safeCount = Number(count) || 0;
      if (safeCount <= 0) return;
      const now = new Date();
      await ensureMonthContext(tenantId, now);
      await repository.incrementRemindersCount(tenantId, safeCount, now);
    }
  };
};

