import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { paymentLogger, webhookLogger } from '../../config/logger.js';
import {
  createTenantOrder as createTenantRazorpayOrder,
  getRazorpayPublicKeyId,
  verifyRazorpayWebhookSignature
} from '../../adapters/razorpay.adapter.js';
import { TenantContext } from '../../core/context/tenantContext.js';
import { TenantIntegration } from '../integrations/integration.model.js';
import { decryptSecret } from '../../utils/secretCipher.js';

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

const buildTenantSnapshot = ({ subscription, plan, statusOverride, billingCycle = 'monthly' }) => {
  const subscriptionStatus = statusOverride || subscription?.status || 'expired';
  const paymentStatus = subscription ? 'paid' : 'pending';
  const nextPaymentDate = subscription?.endDate || null;

  return {
    currentPlanId: plan?._id || null,
    planName: plan?.name || null,
    planPrice: plan?.priceMonthly ?? 0,
    studentLimit: typeof plan?.studentLimit === 'number' ? plan.studentLimit : null,
    subscriptionStatus,
    paymentStatus,
    billingCycle,
    planStartDate: subscription?.startDate || null,
    planEndDate: subscription?.endDate || null,
    nextPaymentDate
  };
};

const toPlain = (value) => (value?.toObject ? value.toObject() : value);

export const createBillingService = (repository, dependencies = {}) => {
  const { tenantMetricsService } = dependencies;
  const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

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
      const expired = await repository.updateSubscriptionById(tenantId, subscription._id, {
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

    async createTenantOrder(payload) {
      const tenantId = resolveTenantId();
      const amountInPaise = Math.round(payload.amount * 100);
      if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
        throw new AppError('Invalid amount', StatusCodes.BAD_REQUEST);
      }

      const currency = payload.currency || 'INR';
      const notes = {
        ...(payload.notes || {}),
        tenantId
      };
      const receipt = payload.receipt || `tenant-${tenantId}-${Date.now()}`;
      const order = await createTenantRazorpayOrder({
        tenantId,
        amount: amountInPaise,
        currency,
        receipt,
        notes
      });
      const keyId = await getRazorpayPublicKeyId({ tenantId, preferTenant: true });

      return {
        orderId: order.id,
        amount: amountInPaise,
        currency,
        receipt,
        keyId,
        notes
      };
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

    async processRazorpayWebhook({ signature, rawBody, payload }) {
      const eventType = payload?.event || 'unknown';
      const paymentEntity = payload?.payload?.payment?.entity;
      const razorpayPaymentId = paymentEntity?.id || null;
      const razorpayOrderId = paymentEntity?.order_id || null;
      const notes = paymentEntity?.notes || {};
      const tenantIdFromNotes = notes.tenantId || notes.tenant_id || null;

      try {
        let tenantWebhookSecret = null;
        if (tenantIdFromNotes) {
          const record = await TenantIntegration.findOne({ tenantId: tenantIdFromNotes })
            .select({ 'razorpay.webhookSecretEnc': 1 })
            .lean();
          if (record?.razorpay?.webhookSecretEnc) {
            try {
              tenantWebhookSecret = decryptSecret(record.razorpay.webhookSecretEnc);
            } catch {
              tenantWebhookSecret = null;
            }
          }
        }

        const signatureValid = verifyRazorpayWebhookSignature({
          rawBody,
          signature,
          secret: tenantWebhookSecret || undefined
        });
        if (!signatureValid) {
          webhookLogger.warn(
            {
              tenantId: null,
              eventType,
              razorpayPaymentId,
              reason: 'invalid_signature'
            },
            'Razorpay webhook rejected'
          );
          return {
            accepted: true,
            status: 'invalid_signature'
          };
        }
      } catch (error) {
        webhookLogger.error(
          {
            tenantId: null,
            eventType,
            razorpayPaymentId,
            err: error
          },
          'Razorpay webhook signature verification error'
        );
        return {
          accepted: true,
          status: 'processing_error'
        };
      }

      try {
        if (!['payment.captured', 'payment.failed', 'order.paid'].includes(eventType)) {
          webhookLogger.info(
            {
              tenantId: null,
              eventType,
              razorpayPaymentId,
              status: 'ignored'
            },
            'Razorpay webhook ignored'
          );
          return {
            accepted: true,
            status: 'ignored'
          };
        }

        if (!razorpayPaymentId) {
          webhookLogger.error(
            {
              tenantId: null,
              eventType,
              reason: 'missing_payment_id'
            },
            'Razorpay webhook processing error'
          );
          return {
            accepted: true,
            status: 'processing_error'
          };
        }

        if (eventType === 'payment.failed') {
          webhookLogger.info(
            {
              tenantId: tenantIdFromNotes || null,
              eventType,
              razorpayPaymentId,
              status: 'failed'
            },
            'Razorpay payment failed webhook received'
          );

          if (tenantIdFromNotes) {
            await repository.updateTenantPaymentSnapshot(tenantIdFromNotes, {
              paymentStatus: 'failed'
            });
          }

          return {
            accepted: true,
            status: 'failed'
          };
        }

        const duplicate = await repository.findPaymentByRazorpayPaymentId(razorpayPaymentId, tenantIdFromNotes);
        if (duplicate) {
          webhookLogger.warn(
            {
              tenantId: String(duplicate.tenantId || ''),
              eventType,
              razorpayPaymentId,
              status: 'duplicate'
            },
            'Duplicate Razorpay webhook attempt'
          );
          return {
            accepted: true,
            status: 'duplicate'
          };
        }

        const tenantId = notes.tenantId || notes.tenant_id || null;
        const studentId = notes.studentId || notes.student_id || null;

        if (!tenantId || !studentId) {
          webhookLogger.error(
            {
              tenantId: tenantId || null,
              eventType,
              razorpayPaymentId,
              reason: 'missing_tenant_or_student_in_notes'
            },
            'Razorpay webhook processing error'
          );
          return {
            accepted: true,
            status: 'processing_error'
          };
        }

        const recorder = await repository.findDefaultRecorderUser(tenantId);
        if (!recorder?._id) {
          webhookLogger.error(
            {
              tenantId,
              eventType,
              razorpayPaymentId,
              reason: 'recorder_user_not_found'
            },
            'Razorpay webhook processing error'
          );
          return {
            accepted: true,
            status: 'processing_error'
          };
        }

        const amountPaid = Number(paymentEntity?.amount || 0) / 100;
        const paymentDate = paymentEntity?.created_at ? new Date(Number(paymentEntity.created_at) * 1000) : new Date();

        if (!(amountPaid > 0)) {
          webhookLogger.error(
            {
              tenantId,
              eventType,
              razorpayPaymentId,
              reason: 'invalid_amount'
            },
            'Razorpay webhook processing error'
          );
          return {
            accepted: true,
            status: 'processing_error'
          };
        }

        try {
          await repository.createWebhookPayment({
            tenantId,
            studentId,
            amountPaid,
            paymentDate,
            paymentMode: 'online',
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature: signature || null,
            paymentSource: 'razorpay_webhook',
            referenceNote: `Razorpay captured webhook (${eventType})`,
            recordedBy: recorder._id
          });
        } catch (error) {
          if (error?.code === 11000) {
            webhookLogger.warn(
              {
                tenantId,
                eventType,
                razorpayPaymentId,
                status: 'duplicate'
              },
              'Duplicate Razorpay payment ignored by unique index'
            );
            return {
              accepted: true,
              status: 'duplicate'
            };
          }

          webhookLogger.error(
            {
              tenantId,
              eventType,
              razorpayPaymentId,
              err: error
            },
            'Razorpay webhook processing error'
          );
          return {
            accepted: true,
            status: 'processing_error'
          };
        }

        await repository.updateTenantPaymentSnapshot(tenantId, {
          paymentStatus: 'paid',
          lastPaymentDate: paymentDate
        });

        if (tenantMetricsService?.incrementPaymentsRecordedThisMonth) {
          await tenantMetricsService.incrementPaymentsRecordedThisMonth(String(tenantId), 1);
        }

        webhookLogger.info(
          {
            tenantId,
            eventType,
            razorpayPaymentId,
            status: 'success'
          },
          'Razorpay webhook processed successfully'
        );
        paymentLogger.info(
          {
            tenantId,
            eventType,
            razorpayPaymentId,
            amountPaid,
            paymentMode: 'online',
            source: 'razorpay_webhook'
          },
          'Webhook payment recorded'
        );

        return {
          accepted: true,
          status: 'success'
        };
      } catch (error) {
        webhookLogger.error(
          {
            tenantId: null,
            eventType,
            razorpayPaymentId,
            err: error
          },
          'Razorpay webhook unhandled processing error'
        );
        return {
          accepted: true,
          status: 'processing_error'
        };
      }
    },

    async createTrialForTenant(tenantId) {
      const scopedTenantId = resolveTenantId(tenantId);
      await ensureDefaultPlans();

      const existing = await repository.findCurrentSubscription(scopedTenantId);
      if (existing) {
        return existing;
      }

      const startDate = normalizeDate(new Date());
      const endDate = addDaysUTC(startDate, 14);

      const defaultPlan = (await repository.findActivePlanByName('Starter')) || (await repository.findLowestActivePlan());

      const trial = await repository.createSubscription({
        tenantId: scopedTenantId,
        planId: defaultPlan?._id || null,
        startDate,
        endDate,
        status: 'trial',
        autoRenew: false
      });

      await repository.updateTenantSubscription(scopedTenantId, buildTenantSnapshot({ subscription: trial, plan: defaultPlan }));

      return trial;
    },

    async subscribeTenant(payload, tenantId = null) {
      const scopedTenantId = resolveTenantId(tenantId);
      await ensureDefaultPlans();

      const plan = await repository.findPlanById(payload.planId);
      if (!plan || plan.status !== 'active') {
        throw new AppError('Plan not found or inactive', StatusCodes.BAD_REQUEST);
      }

      await repository.cancelAllActiveSubscriptions(scopedTenantId);

      const startDate = payload.startDate ? normalizeDate(payload.startDate) : normalizeDate(new Date());
      const endDate = addMonthsUTC(startDate, 1);

      const subscription = await repository.createSubscription({
        tenantId: scopedTenantId,
        planId: plan._id,
        startDate,
        endDate,
        status: 'active',
        autoRenew: payload.autoRenew ?? true
      });

      await repository.updateTenantSubscription(scopedTenantId, buildTenantSnapshot({ subscription, plan }));

      return buildSubscriptionResponse(scopedTenantId, subscription.toObject ? subscription.toObject() : subscription);
    },

    async activateTenantPlanByName(tenantId, planName, autoRenew = true) {
      const scopedTenantId = resolveTenantId(tenantId);
      await ensureDefaultPlans();
      const plan = await repository.findActivePlanByName(planName);
      if (!plan) {
        throw new AppError('Plan not found or inactive', StatusCodes.BAD_REQUEST);
      }

      await repository.cancelAllActiveSubscriptions(scopedTenantId);

      const startDate = normalizeDate(new Date());
      const endDate = addMonthsUTC(startDate, 1);

      const subscription = await repository.createSubscription({
        tenantId: scopedTenantId,
        planId: plan._id,
        startDate,
        endDate,
        status: 'active',
        autoRenew
      });

      await repository.updateTenantSubscription(scopedTenantId, buildTenantSnapshot({ subscription, plan }));

      return buildSubscriptionResponse(scopedTenantId, toPlain(subscription));
    },

    async upgradePlan(payload, tenantId = null) {
      const scopedTenantId = resolveTenantId(tenantId);
      await ensureDefaultPlans();

      const plan = await repository.findPlanById(payload.planId);
      if (!plan || plan.status !== 'active') {
        throw new AppError('Plan not found or inactive', StatusCodes.BAD_REQUEST);
      }

      await repository.cancelAllActiveSubscriptions(scopedTenantId);

      const startDate = normalizeDate(new Date());
      const endDate = addMonthsUTC(startDate, 1);

      const subscription = await repository.createSubscription({
        tenantId: scopedTenantId,
        planId: plan._id,
        startDate,
        endDate,
        status: 'active',
        autoRenew: payload.autoRenew ?? true
      });

      await repository.updateTenantSubscription(scopedTenantId, buildTenantSnapshot({ subscription, plan }));

      return buildSubscriptionResponse(scopedTenantId, subscription.toObject ? subscription.toObject() : subscription);
    },

    async cancelSubscription(tenantId = null) {
      const scopedTenantId = resolveTenantId(tenantId);
      const subscription = await syncCurrentSubscriptionState(scopedTenantId);
      if (!subscription) {
        throw new AppError('Subscription not found', StatusCodes.NOT_FOUND);
      }

      const cancelled = await repository.updateSubscriptionById(scopedTenantId, subscription._id, {
        status: 'cancelled',
        autoRenew: false
      });

      const plan = cancelled?.planId ? await repository.findPlanById(cancelled.planId) : null;
      await repository.updateTenantSubscription(
        scopedTenantId,
        buildTenantSnapshot({ subscription: cancelled, plan, statusOverride: 'expired' })
      );

      return cancelled;
    },

    async getCurrentSubscription(tenantId = null) {
      const scopedTenantId = resolveTenantId(tenantId);
      const subscription = await syncCurrentSubscriptionState(scopedTenantId);
      if (!subscription) {
        throw new AppError('Subscription not found', StatusCodes.NOT_FOUND);
      }

      return buildSubscriptionResponse(scopedTenantId, subscription);
    },

    async getCurrentUsage(tenantId = null) {
      const scopedTenantId = resolveTenantId(tenantId);
      await ensureDefaultPlans();
      await syncCurrentSubscriptionState(scopedTenantId);

      const tenant = await repository.findTenantById(scopedTenantId);
      if (!tenant) {
        throw new AppError('Tenant not found', StatusCodes.NOT_FOUND);
      }

      let plan = tenant.currentPlanId ? await repository.findPlanById(tenant.currentPlanId) : null;

      if (!plan && tenant.planName) {
        plan = await repository.findPlanByName(tenant.planName);
      }

      const currentUsage = await repository.countActiveStudents(scopedTenantId);
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
      const scopedTenantId = resolveTenantId(tenantId);
      if (resourceType !== 'student') {
        throw new AppError('Unsupported resource type for plan check', StatusCodes.BAD_REQUEST);
      }

      await ensureDefaultPlans();
      await syncCurrentSubscriptionState(scopedTenantId);

      const tenant = await repository.findTenantById(scopedTenantId);
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
      const currentUsage = await repository.countActiveStudents(scopedTenantId);
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
      const scopedTenantId = resolveTenantId(tenantId);
      const subscription = await syncCurrentSubscriptionState(scopedTenantId);
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
        const limit = await this.checkPlanLimit(scopedTenantId, 'student');
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
