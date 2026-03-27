import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const BILLING_CYCLE_MONTHS = {
  monthly: 1,
  yearly: 12
};

const addMonthsUTC = (date, months) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const formatInvoiceNumber = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${stamp}-${suffix}`;
};

export const createTenantService = (dependencies) => {
  const { billingService, billingRepository, tenantRepository } = dependencies;
  const resolveTenantId = () => TenantContext.requireTenantId();

  const mapSummary = async (tenantId) => {
    const tenant = await billingRepository.findTenantById(tenantId);
    if (!tenant) {
      throw new AppError('Tenant not found', StatusCodes.NOT_FOUND);
    }

    let subscription = null;
    try {
      subscription = await billingService.getCurrentSubscription(tenantId);
    } catch {
      subscription = null;
    }

    const usage = await billingService.getCurrentUsage(tenantId);
    const plan = tenant.currentPlanId ? await billingRepository.findPlanById(tenant.currentPlanId) : null;
    const resolvedPlanName = tenant.planName || usage.planName || plan?.name || 'Starter';
    const resolvedPlanPrice = tenant.customPriceOverride ?? plan?.priceMonthly ?? 0;
    const resolvedStudentLimit =
      typeof tenant.studentLimit === 'number'
        ? tenant.studentLimit
        : typeof usage.studentLimit === 'number'
          ? usage.studentLimit
          : plan?.studentLimit ?? null;
    const currentStudentCount =
      typeof tenant.currentStudentCount === 'number'
        ? tenant.currentStudentCount
        : typeof tenant.totalStudents === 'number'
          ? tenant.totalStudents
          : usage.currentUsage || 0;
    const nextPaymentDate = tenant.nextPaymentDate || tenant.planEndDate || subscription?.endDate || null;
    const billingCycle = tenant.billingCycle || 'monthly';
    const cycleMonths = BILLING_CYCLE_MONTHS[billingCycle] || 1;

    return {
      planName: resolvedPlanName,
      planPrice: resolvedPlanPrice,
      studentLimit: resolvedStudentLimit,
      currentStudentCount,
      usagePercent:
        resolvedStudentLimit && resolvedStudentLimit > 0
          ? Math.min(100, Math.round((currentStudentCount / resolvedStudentLimit) * 100))
          : currentStudentCount > 0
            ? 100
            : 0,
      nextPaymentDate,
      billingCycle,
      status: tenant.subscriptionStatus || usage.subscriptionStatus || 'trial',
      autoRenew: Boolean(subscription?.autoRenew ?? tenant.subscriptionStatus === 'active'),
      planStartDate: tenant.planStartDate || subscription?.startDate || null,
      planEndDate: tenant.planEndDate || subscription?.endDate || null,
      cycleMonths
    };
  };

  return {
    async getPlans() {
      const plans = await tenantRepository.listActivePlans();
      return plans.map((plan) => ({
        id: String(plan._id),
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        studentLimit: plan.studentLimit ?? null,
        features: plan.features || [],
        status: plan.status
      }));
    },

    async getSubscription() {
      const tenantId = resolveTenantId();
      return mapSummary(tenantId);
    },

    async upgradePlan(planId) {
      const tenantId = resolveTenantId();
      const plan = await billingRepository.findPlanById(planId);
      if (!plan || plan.status !== 'active') {
        throw new AppError('Plan not found or inactive', StatusCodes.BAD_REQUEST);
      }

      const subscription = await billingService.upgradePlan({ planId, autoRenew: true }, tenantId);
      const now = new Date();
      const billingCycle = 'monthly';
      const paymentDate = now;
      const nextPaymentDate = addMonthsUTC(now, billingCycle === 'yearly' ? 12 : 1);

      const payment = await tenantRepository.createBillingPayment({
        tenantId,
        planId: plan._id,
        planName: plan.name,
        amount: plan.priceMonthly,
        currency: 'INR',
        billingCycle,
        status: 'paid',
        paymentDate,
        nextPaymentDate,
        autoRenew: true,
        invoiceNumber: formatInvoiceNumber(),
        invoiceLabel: `${plan.name} subscription`
      });

      return {
        success: true,
        paymentMode: 'mock',
        paymentLink: null,
        subscription: await mapSummary(tenantId),
        payment
      };
    },

    async getPayments() {
      const tenantId = resolveTenantId();
      const items = await tenantRepository.listBillingPayments(tenantId, 24);

      return items.map((item) => ({
        id: String(item._id),
        date: item.paymentDate || item.createdAt,
        amount: item.amount,
        status: item.status,
        planName: item.planName,
        invoiceNumber: item.invoiceNumber,
        invoiceLabel: item.invoiceLabel || item.planName,
        billingCycle: item.billingCycle,
        autoRenew: Boolean(item.autoRenew),
        nextPaymentDate: item.nextPaymentDate || null,
        invoiceDownloadName: `${item.invoiceNumber}.txt`
      }));
    }
  };
};
