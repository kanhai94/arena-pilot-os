import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';

const PLAN_LIMIT_ERROR_CODE = 'PLAN_LIMIT_REACHED';
const PLAN_LIMIT_MESSAGE = 'Student limit reached. Upgrade your plan.';

const DEFAULT_PLANS = [
  {
    name: 'Starter',
    priceMonthly: 0,
    studentLimit: 10,
    features: ['Up to 10 active students', 'Basic student management', 'Manual attendance']
  },
  {
    name: 'Growth',
    priceMonthly: 1999,
    studentLimit: 50,
    features: ['Up to 50 active students', 'Attendance and fee modules', 'Notification automation']
  },
  {
    name: 'Pro',
    priceMonthly: 4999,
    studentLimit: null,
    features: ['Unlimited active students', 'Priority support', 'Advanced automation and analytics']
  }
];

const normalizeDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('Invalid date', StatusCodes.BAD_REQUEST);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const addDaysUTC = (date, days) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
};

const addMonthsUTC = (date, months) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
};

const serializePlan = (plan) => {
  if (!plan) {
    return null;
  }

  return {
    id: String(plan._id),
    name: plan.name,
    priceMonthly: plan.priceMonthly,
    studentLimit: plan.studentLimit,
    features: plan.features,
    status: plan.status
  };
};

const buildTenantSnapshot = ({ subscription, plan, statusOverride }) => {
  const subscriptionStatus = statusOverride || subscription?.status || 'expired';

  return {
    currentPlanId: plan?._id || null,
    planName: plan?.name || null,
    studentLimit: typeof plan?.studentLimit === 'number' ? plan.studentLimit : null,
    subscriptionStatus,
    planStartDate: subscription?.startDate || null,
    planEndDate: subscription?.endDate || null
  };
};

const toPlain = (value) => (value?.toObject ? value.toObject() : value);

export const createBillingService = (repository) => {
  const ensureDefaultPlans = async () => {
    await Promise.all(
      DEFAULT_PLANS.map((plan) =>
        repository.upsertPlanByName(plan.name, {
          name: plan.name,
          priceMonthly: plan.priceMonthly,
          studentLimit: plan.studentLimit,
          features: plan.features,
          status: 'active'
        })
      )
    );
  };

  const syncCurrentSubscriptionState = async (tenantId) => {
    const subscription = await repository.findCurrentSubscription(tenantId);
    if (!subscription) {
      return null;
    }

    const now = new Date();
    if ((subscription.status === 'trial' || subscription.status === 'active') && new Date(subscription.endDate) < now) {
      const expired = await repository.updateSubscriptionById(subscription._id, {
        status: 'expired',
        autoRenew: false
      });

      const plan = expired?.planId ? await repository.findPlanById(expired.planId) : null;
      await repository.updateTenantSubscription(
        tenantId,
        buildTenantSnapshot({ subscription: expired, plan, statusOverride: 'expired' })
      );

      return expired;
    }

    return subscription;
  };

  const buildSubscriptionResponse = async (tenantId, subscription) => {
    const plan = subscription.planId ? await repository.findPlanById(subscription.planId) : null;
    return {
      ...subscription,
      plan: serializePlan(plan)
    };
  };

  return {
    ensureDefaultPlans,
    syncCurrentSubscriptionState,

    async createPlan(payload) {
      try {
        await ensureDefaultPlans();
        return await repository.createPlan({
          name: payload.name,
          priceMonthly: payload.priceMonthly,
          studentLimit: payload.studentLimit,
          features: payload.features || [],
          status: payload.status || 'active'
        });
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError('Plan with same name already exists', StatusCodes.CONFLICT);
        }
        throw error;
      }
    },

    async getRegistrationPlanQuote(planName) {
      await ensureDefaultPlans();

      const plan = await repository.findActivePlanByName(planName);
      if (!plan) {
        throw new AppError('Plan not found or inactive', StatusCodes.BAD_REQUEST);
      }

      return {
        planName: plan.name,
        amountInPaise: Math.round(plan.priceMonthly * 100),
        amountMonthly: plan.priceMonthly,
        currency: 'INR',
        studentLimit: plan.studentLimit
      };
    },

    async createTrialForTenant(tenantId) {
      await ensureDefaultPlans();

      const existing = await repository.findCurrentSubscription(tenantId);
      if (existing) {
        return existing;
      }

      const startDate = normalizeDate(new Date());
      const endDate = addDaysUTC(startDate, 14);

      const defaultPlan = (await repository.findActivePlanByName('Starter')) || (await repository.findLowestActivePlan());

      const trial = await repository.createSubscription({
        tenantId,
        planId: defaultPlan?._id || null,
        startDate,
        endDate,
        status: 'trial',
        autoRenew: false
      });

      await repository.updateTenantSubscription(tenantId, buildTenantSnapshot({ subscription: trial, plan: defaultPlan }));

      return trial;
    },

    async subscribeTenant(tenantId, payload) {
      await ensureDefaultPlans();

      const plan = await repository.findPlanById(payload.planId);
      if (!plan || plan.status !== 'active') {
        throw new AppError('Plan not found or inactive', StatusCodes.BAD_REQUEST);
      }

      await repository.cancelAllActiveSubscriptions(tenantId);

      const startDate = payload.startDate ? normalizeDate(payload.startDate) : normalizeDate(new Date());
      const endDate = addMonthsUTC(startDate, 1);

      const subscription = await repository.createSubscription({
        tenantId,
        planId: plan._id,
        startDate,
        endDate,
        status: 'active',
        autoRenew: payload.autoRenew ?? true
      });

      await repository.updateTenantSubscription(tenantId, buildTenantSnapshot({ subscription, plan }));

      return buildSubscriptionResponse(tenantId, subscription.toObject ? subscription.toObject() : subscription);
    },

    async activateTenantPlanByName(tenantId, planName, autoRenew = true) {
      await ensureDefaultPlans();
      const plan = await repository.findActivePlanByName(planName);
      if (!plan) {
        throw new AppError('Plan not found or inactive', StatusCodes.BAD_REQUEST);
      }

      await repository.cancelAllActiveSubscriptions(tenantId);

      const startDate = normalizeDate(new Date());
      const endDate = addMonthsUTC(startDate, 1);

      const subscription = await repository.createSubscription({
        tenantId,
        planId: plan._id,
        startDate,
        endDate,
        status: 'active',
        autoRenew
      });

      await repository.updateTenantSubscription(tenantId, buildTenantSnapshot({ subscription, plan }));

      return buildSubscriptionResponse(tenantId, toPlain(subscription));
    },

    async upgradePlan(tenantId, payload) {
      await ensureDefaultPlans();

      const plan = await repository.findPlanById(payload.planId);
      if (!plan || plan.status !== 'active') {
        throw new AppError('Plan not found or inactive', StatusCodes.BAD_REQUEST);
      }

      await repository.cancelAllActiveSubscriptions(tenantId);

      const startDate = normalizeDate(new Date());
      const endDate = addMonthsUTC(startDate, 1);

      const subscription = await repository.createSubscription({
        tenantId,
        planId: plan._id,
        startDate,
        endDate,
        status: 'active',
        autoRenew: payload.autoRenew ?? true
      });

      await repository.updateTenantSubscription(tenantId, buildTenantSnapshot({ subscription, plan }));

      return buildSubscriptionResponse(tenantId, subscription.toObject ? subscription.toObject() : subscription);
    },

    async cancelSubscription(tenantId) {
      const subscription = await syncCurrentSubscriptionState(tenantId);
      if (!subscription) {
        throw new AppError('Subscription not found', StatusCodes.NOT_FOUND);
      }

      const cancelled = await repository.updateSubscriptionById(subscription._id, {
        status: 'cancelled',
        autoRenew: false
      });

      const plan = cancelled?.planId ? await repository.findPlanById(cancelled.planId) : null;
      await repository.updateTenantSubscription(
        tenantId,
        buildTenantSnapshot({ subscription: cancelled, plan, statusOverride: 'expired' })
      );

      return cancelled;
    },

    async getCurrentSubscription(tenantId) {
      const subscription = await syncCurrentSubscriptionState(tenantId);
      if (!subscription) {
        throw new AppError('Subscription not found', StatusCodes.NOT_FOUND);
      }

      return buildSubscriptionResponse(tenantId, subscription);
    },

    async getCurrentUsage(tenantId) {
      await ensureDefaultPlans();
      await syncCurrentSubscriptionState(tenantId);

      const tenant = await repository.findTenantById(tenantId);
      if (!tenant) {
        throw new AppError('Tenant not found', StatusCodes.NOT_FOUND);
      }

      let plan = tenant.currentPlanId ? await repository.findPlanById(tenant.currentPlanId) : null;

      if (!plan && tenant.planName) {
        plan = await repository.findPlanByName(tenant.planName);
      }

      const currentUsage = await repository.countActiveStudents(tenantId);
      const studentLimit = typeof tenant.studentLimit === 'number' ? tenant.studentLimit : plan?.studentLimit ?? null;
      const remainingSlots = studentLimit === null ? null : Math.max(studentLimit - currentUsage, 0);

      return {
        planName: tenant.planName || plan?.name || 'Unassigned',
        studentLimit,
        currentUsage,
        remainingSlots,
        subscriptionStatus: tenant.subscriptionStatus
      };
    },

    async checkPlanLimit(tenantId, resourceType, options = {}) {
      if (resourceType !== 'student') {
        throw new AppError('Unsupported resource type for plan check', StatusCodes.BAD_REQUEST);
      }

      await ensureDefaultPlans();
      await syncCurrentSubscriptionState(tenantId);

      const tenant = await repository.findTenantById(tenantId);
      if (!tenant) {
        throw new AppError('Tenant not found', StatusCodes.NOT_FOUND);
      }

      let plan = tenant.currentPlanId ? await repository.findPlanById(tenant.currentPlanId) : null;
      if (!plan && tenant.planName) {
        plan = await repository.findPlanByName(tenant.planName);
      }

      const studentLimit =
        typeof tenant.studentLimit === 'number'
          ? tenant.studentLimit
          : typeof plan?.studentLimit === 'number'
            ? plan.studentLimit
            : null;
      const currentUsage = await repository.countActiveStudents(tenantId);
      const remainingSlots = studentLimit === null ? null : Math.max(studentLimit - currentUsage, 0);
      const isLimitReached = studentLimit !== null && currentUsage >= studentLimit;

      const result = {
        allowed: !isLimitReached,
        resourceType,
        planName: tenant.planName || plan?.name || 'Unassigned',
        studentLimit,
        currentUsage,
        remainingSlots
      };

      if (isLimitReached && options.throwOnLimitReached) {
        throw new AppError(
          PLAN_LIMIT_MESSAGE,
          StatusCodes.FORBIDDEN,
          {
            code: PLAN_LIMIT_ERROR_CODE,
            resourceType,
            studentLimit,
            currentUsage
          },
          {
            errorCode: PLAN_LIMIT_ERROR_CODE,
            upgradeRequired: true
          }
        );
      }

      return result;
    },

    async getGuardAccess(tenantId, options = {}) {
      const subscription = await syncCurrentSubscriptionState(tenantId);
      if (!subscription) {
        return {
          allowed: false,
          reason: 'No subscription configured',
          statusCode: StatusCodes.PAYMENT_REQUIRED
        };
      }

      if (subscription.status === 'expired' || subscription.status === 'cancelled') {
        return {
          allowed: false,
          reason: `Subscription ${subscription.status}`,
          statusCode: StatusCodes.PAYMENT_REQUIRED,
          subscription
        };
      }

      if (options.enforceStudentLimit) {
        const limit = await this.checkPlanLimit(tenantId, 'student');
        if (!limit.allowed) {
          return {
            allowed: false,
            reason: PLAN_LIMIT_MESSAGE,
            statusCode: StatusCodes.FORBIDDEN,
            meta: {
              code: PLAN_LIMIT_ERROR_CODE,
              studentLimit: limit.studentLimit,
              currentUsage: limit.currentUsage
            },
            subscription
          };
        }
      }

      return {
        allowed: true,
        subscription: toPlain(subscription)
      };
    }
  };
};
