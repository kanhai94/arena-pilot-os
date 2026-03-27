import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { TenantContext } from '../../core/context/tenantContext.js';
import {
  createRegistrationOrder as createPlatformRazorpayOrder,
  getRazorpayPublicKeyId,
  verifyRazorpaySignature
} from '../../adapters/razorpay.adapter.js';
import { buildRazorpayReceipt } from '../../utils/razorpayReceipt.js';

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

const getBillingCycleMonths = (billingCycle) => BILLING_CYCLE_MONTHS[billingCycle] || 1;

const buildBillingPaymentPayload = ({ tenantId, plan, amount, billingCycle, payment = null, autoRenew = true }) => {
  const now = new Date();
  const nextPaymentDate = addMonthsUTC(now, getBillingCycleMonths(billingCycle));

  return {
    tenantId,
    planId: plan._id,
    planName: plan.name,
    amount,
    currency: 'INR',
    billingCycle,
    status: 'paid',
    paymentDate: now,
    nextPaymentDate,
    autoRenew,
    invoiceNumber: formatInvoiceNumber(),
    invoiceLabel: `${plan.name} subscription`,
    razorpayOrderId: payment?.razorpayOrderId || null,
    razorpayPaymentId: payment?.razorpayPaymentId || null,
    razorpaySignature: payment?.razorpaySignature || null
  };
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

  const resolveUpgradePlan = async (planIdentifier) => {
    const directPlan = await billingRepository.findPlanById(planIdentifier);
    if (directPlan && directPlan.status === 'active') {
      return directPlan;
    }

    const namedPlan = await billingRepository.findActivePlanByName(String(planIdentifier || '').trim());
    if (namedPlan) {
      return namedPlan;
    }

    return null;
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

    async upgradePlan(planId, payment = null, autoRenew = true) {
      const tenantId = resolveTenantId();
      const plan = await resolveUpgradePlan(planId);
      if (!plan || plan.status !== 'active') {
        throw new AppError('Plan not found or inactive', StatusCodes.BAD_REQUEST);
      }

      const billingCycle = 'monthly';
      const amount = Number(plan.priceMonthly || 0);

      if (amount <= 0) {
        await billingService.upgradePlan({ planId, autoRenew }, tenantId);
        const freePayment = await tenantRepository.createBillingPayment(
          buildBillingPaymentPayload({
            tenantId,
            plan,
            amount,
            billingCycle,
            autoRenew
          })
        );

        return {
          success: true,
          stage: 'completed',
          paymentMode: 'free',
          requiresPayment: false,
          paymentLink: null,
          subscription: await mapSummary(tenantId),
          payment: freePayment
        };
      }

      if (!payment) {
        const receipt = buildRazorpayReceipt('tu', tenantId);
        const order = await createPlatformRazorpayOrder({
          amount: Math.round(amount * 100),
          currency: 'INR',
          receipt,
          notes: {
            tenantId: String(tenantId),
            planId: String(plan._id),
            planName: plan.name,
            purpose: 'tenant_upgrade'
          }
        });

        return {
          success: true,
          stage: 'order_created',
          paymentMode: 'razorpay',
          requiresPayment: true,
          keyId: await getRazorpayPublicKeyId(),
          orderId: order.id,
          amount: Math.round(amount * 100),
          currency: 'INR',
          planId: String(plan._id),
          planName: plan.name
        };
      }

      const isValidSignature = await verifyRazorpaySignature({
        orderId: payment.razorpayOrderId,
        paymentId: payment.razorpayPaymentId,
        signature: payment.razorpaySignature
      });

      if (!isValidSignature) {
        throw new AppError('Invalid payment signature', StatusCodes.BAD_REQUEST);
      }

      const existingPayment = await tenantRepository.findBillingPaymentByRazorpayPaymentId(payment.razorpayPaymentId);
      if (existingPayment) {
        return {
          success: true,
          stage: 'completed',
          paymentMode: 'razorpay',
          requiresPayment: false,
          paymentLink: null,
          subscription: await mapSummary(tenantId),
          payment: existingPayment
        };
      }

      await billingService.upgradePlan({ planId, autoRenew }, tenantId);

      const billingPayment = await tenantRepository.createBillingPayment(
        buildBillingPaymentPayload({
          tenantId,
          plan,
          amount,
          billingCycle,
          payment,
          autoRenew
        })
      );

      return {
        success: true,
        stage: 'completed',
        paymentMode: 'razorpay',
        requiresPayment: false,
        paymentLink: null,
        subscription: await mapSummary(tenantId),
        payment: billingPayment
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
