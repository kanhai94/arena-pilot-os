import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';

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

export const createBillingService = (repository) => {
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

      await repository.updateTenantSubscription(tenantId, {
        subscriptionStatus: 'expired'
      });

      return expired;
    }

    return subscription;
  };

  const buildSubscriptionResponse = async (tenantId, subscription) => {
    const plan = subscription.planId ? await repository.findPlanById(subscription.planId) : null;
    return {
      ...subscription,
      plan: plan
        ? {
            id: String(plan._id),
            name: plan.name,
            priceMonthly: plan.priceMonthly,
            studentLimit: plan.studentLimit,
            features: plan.features,
            status: plan.status
          }
        : null
    };
  };

  return {
    syncCurrentSubscriptionState,

    async createPlan(payload) {
      try {
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

    async createTrialForTenant(tenantId) {
      const existing = await repository.findCurrentSubscription(tenantId);
      if (existing) {
        return existing;
      }

      const startDate = normalizeDate(new Date());
      const endDate = addDaysUTC(startDate, 14);

      const defaultPlan = (await repository.findPlanByName('Starter')) || (await repository.findLowestActivePlan());

      const trial = await repository.createSubscription({
        tenantId,
        planId: defaultPlan?._id || null,
        startDate,
        endDate,
        status: 'trial',
        autoRenew: false
      });

      await repository.updateTenantSubscription(tenantId, {
        subscriptionStatus: 'trial',
        currentPlanId: defaultPlan?._id || null
      });

      return trial;
    },

    async subscribeTenant(tenantId, payload) {
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

      await repository.updateTenantSubscription(tenantId, {
        subscriptionStatus: 'active',
        currentPlanId: plan._id
      });

      return buildSubscriptionResponse(tenantId, subscription.toObject ? subscription.toObject() : subscription);
    },

    async upgradePlan(tenantId, payload) {
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

      await repository.updateTenantSubscription(tenantId, {
        subscriptionStatus: 'active',
        currentPlanId: plan._id
      });

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

      await repository.updateTenantSubscription(tenantId, {
        subscriptionStatus: 'cancelled'
      });

      return cancelled;
    },

    async getCurrentSubscription(tenantId) {
      const subscription = await syncCurrentSubscriptionState(tenantId);
      if (!subscription) {
        throw new AppError('Subscription not found', StatusCodes.NOT_FOUND);
      }

      return buildSubscriptionResponse(tenantId, subscription);
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
        const plan = subscription.planId ? await repository.findPlanById(subscription.planId) : null;
        if (plan) {
          const currentStudents = await repository.countActiveStudents(tenantId);
          if (currentStudents >= plan.studentLimit) {
            return {
              allowed: false,
              reason: 'Student limit reached for current plan',
              statusCode: StatusCodes.FORBIDDEN,
              meta: {
                studentLimit: plan.studentLimit,
                currentStudents
              },
              subscription,
              plan
            };
          }
        }
      }

      return {
        allowed: true,
        subscription
      };
    }
  };
};
