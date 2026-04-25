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

export const clampCurrency = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Number(numericValue.toFixed(2)));
};

export const resolveDiscountAmounts = ({ baseAmount, discountType = 'NONE', discountValue = 0, discountScope = 'ONE_TIME' }) => {
  const normalizedBaseAmount = clampCurrency(baseAmount);
  const normalizedDiscountValue = clampCurrency(discountValue);

  if (!normalizedBaseAmount || discountType === 'NONE' || !normalizedDiscountValue) {
    return {
      recurringDiscountAmount: 0,
      oneTimeDiscountAmount: 0,
      effectiveRecurringAmount: normalizedBaseAmount
    };
  }

  const rawDiscountAmount =
    discountType === 'PERCENT'
      ? clampCurrency((normalizedBaseAmount * normalizedDiscountValue) / 100)
      : clampCurrency(normalizedDiscountValue);

  const discountAmount = Math.min(normalizedBaseAmount, rawDiscountAmount);

  if (discountScope === 'EVERY_CYCLE') {
    return {
      recurringDiscountAmount: discountAmount,
      oneTimeDiscountAmount: 0,
      effectiveRecurringAmount: clampCurrency(normalizedBaseAmount - discountAmount)
    };
  }

  return {
    recurringDiscountAmount: 0,
    oneTimeDiscountAmount: discountAmount,
    effectiveRecurringAmount: normalizedBaseAmount
  };
};

export const getCycleCharge = ({ cycleIndex, totalAmount, oneTimeDiscountAmount = 0 }) => {
  const recurringAmount = clampCurrency(totalAmount);
  const firstCycleDiscount = cycleIndex === 0 ? clampCurrency(oneTimeDiscountAmount) : 0;
  return clampCurrency(recurringAmount - firstCycleDiscount);
};

export const getCycleCharges = ({ durationMonths, totalAmount, oneTimeDiscountAmount = 0 }) =>
  Array.from({ length: Math.max(0, durationMonths) }, (_, index) =>
    getCycleCharge({ cycleIndex: index, totalAmount, oneTimeDiscountAmount })
  );

export const getExpectedAmountForCycles = ({ dueCycles, totalAmount, oneTimeDiscountAmount = 0 }) =>
  getCycleCharges({ durationMonths: dueCycles, totalAmount, oneTimeDiscountAmount }).reduce((sum, charge) => sum + charge, 0);

export const getFullPlanAmount = ({ durationMonths, totalAmount, oneTimeDiscountAmount = 0 }) =>
  getExpectedAmountForCycles({ dueCycles: durationMonths, totalAmount, oneTimeDiscountAmount });

export const getCoveredCycles = ({ durationMonths, totalAmount, oneTimeDiscountAmount = 0, totalPaid }) => {
  const charges = getCycleCharges({ durationMonths, totalAmount, oneTimeDiscountAmount });
  let remainingPaid = clampCurrency(totalPaid);
  let coveredCycles = 0;

  for (const charge of charges) {
    if (remainingPaid + 0.0001 < charge) break;
    remainingPaid = clampCurrency(remainingPaid - charge);
    coveredCycles += 1;
  }

  return coveredCycles;
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

export const computeFeeMetrics = ({
  startDate,
  nextDueDate,
  totalAmount,
  durationMonths,
  totalPaid,
  asOfDate,
  oneTimeDiscountAmount = 0
}) => {
  const dueCycles = getDueCycles(startDate, durationMonths, asOfDate);
  const expectedTillDate = getExpectedAmountForCycles({
    dueCycles,
    totalAmount,
    oneTimeDiscountAmount
  });
  const fullPlanAmount = getFullPlanAmount({
    durationMonths,
    totalAmount,
    oneTimeDiscountAmount
  });

  const pendingTillDate = clampCurrency(expectedTillDate - totalPaid);
  const overallPending = clampCurrency(fullPlanAmount - totalPaid);

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
