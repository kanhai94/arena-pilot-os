export const normalizeToUTCDate = (value) => {
  const input = new Date(value);
  if (Number.isNaN(input.getTime())) {
    throw new Error('Invalid date');
  }
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
};

export const addMonthsUTC = (dateValue, months) => {
  const baseDate = new Date(dateValue);
  return new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + months, baseDate.getUTCDate()));
};

export const getDueCycles = (startDate, durationMonths, asOfDate) => {
  const start = new Date(startDate);
  const asOf = new Date(asOfDate);

  if (asOf < start) {
    return 0;
  }

  const rawMonths =
    (asOf.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - start.getUTCMonth());

  const cycleBoundary = addMonthsUTC(start, rawMonths);
  const cycles = asOf < cycleBoundary ? rawMonths : rawMonths + 1;

  return Math.max(0, Math.min(durationMonths, cycles));
};

export const computeFeeMetrics = ({ startDate, nextDueDate, totalAmount, durationMonths, totalPaid, asOfDate }) => {
  const dueCycles = getDueCycles(startDate, durationMonths, asOfDate);
  const expectedTillDate = dueCycles * totalAmount;
  const fullPlanAmount = durationMonths * totalAmount;

  const pendingTillDate = Math.max(0, expectedTillDate - totalPaid);
  const overallPending = Math.max(0, fullPlanAmount - totalPaid);

  const dueStatus = pendingTillDate > 0 && new Date(nextDueDate) <= new Date(asOfDate) ? 'due' : 'clear';

  return {
    dueCycles,
    expectedTillDate,
    fullPlanAmount,
    totalPaid,
    pendingTillDate,
    overallPending,
    dueStatus,
    isCompleted: overallPending === 0
  };
};
