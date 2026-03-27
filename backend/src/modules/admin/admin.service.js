import { encryptSecret } from '../../utils/secretCipher.js';
import { getNotificationQueueStatus } from '../../queues/notification.queue.js';
import { AppError } from '../../errors/appError.js';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env.js';
import mongoose from 'mongoose';

const maskKey = (value) => {
  if (!value) {
    return null;
  }
  const visible = value.slice(-4);
  return `****${visible}`;
};

const maskSecret = (value) => {
  if (!value) {
    return null;
  }
  return '****';
};

export const createAdminService = (repository) => {
  const assertValidTenantId = (tenantId) => {
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new AppError('Invalid tenant id', StatusCodes.BAD_REQUEST);
    }
  };

  const mapTenantView = (tenantDoc) => ({
    id: String(tenantDoc._id),
    academyName: tenantDoc.name,
    ownerName: tenantDoc.ownerName,
    planName: tenantDoc.planName || 'Unassigned',
    workspaceId: tenantDoc.academyCode || null,
    academyCode: tenantDoc.academyCode || null,
    billingEmail: tenantDoc.billingEmail || null,
    studentCount: tenantDoc.totalStudents || 0,
    subscriptionStatus: tenantDoc.subscriptionStatus,
    tenantStatus: tenantDoc.tenantStatus || 'active',
    paymentStatus: tenantDoc.paymentStatus || 'pending',
    customPriceOverride: tenantDoc.customPriceOverride ?? null,
    nextPaymentDate: tenantDoc.planEndDate || null,
    createdAt: tenantDoc.createdAt
  });

  const resolvePlanMeta = async (planName) => {
    const normalizedPlan = (planName || 'Starter').trim();
    const planDoc = await repository.findPlanByName(normalizedPlan);
    return {
      planName: normalizedPlan,
      currentPlanId: planDoc?._id || null,
      studentLimit: planDoc?.studentLimit ?? null
    };
  };

  const generateAcademyCode = async () => {
    const nextValue = await repository.getNextAcademySequence();
    const prefix = env.ACADEMY_CODE_PREFIX.toLowerCase();
    const separator = env.ACADEMY_CODE_SEPARATOR ?? '-';
    return `${prefix}${separator}${String(nextValue).padStart(env.ACADEMY_CODE_PAD, '0')}`;
  };

  return {
    async getPlans() {
      const plans = await repository.listPlans();
      return plans.map((plan) => ({
        id: String(plan._id),
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        studentLimit: plan.studentLimit ?? null,
        status: plan.status,
        features: plan.features || []
      }));
    },

    async updatePlan(planIdentifier, payload) {
      const plan = await repository.findPlanByIdentifier(planIdentifier);
      if (!plan) {
        throw new AppError('Plan not found', StatusCodes.NOT_FOUND);
      }

      const updated = await repository.updatePlanById(plan._id, payload);
      if (!updated) {
        throw new AppError('Plan not found', StatusCodes.NOT_FOUND);
      }

      return {
        id: String(updated._id),
        name: updated.name,
        priceMonthly: updated.priceMonthly,
        studentLimit: updated.studentLimit ?? null,
        status: updated.status,
        features: updated.features || []
      };
    },

    async getTenants(query) {
      const { page, limit } = query;
      const { items, total } = await repository.listTenantsWithStudentCount(query);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    },

    async getRazorpaySettings() {
      const settings = await repository.getPlatformSettings();
      const razorpay = settings?.payments?.razorpay;

      return {
        configured: Boolean(razorpay?.keyId && razorpay?.keySecretEnc),
        isActive: Boolean(razorpay?.isActive),
        keyId: razorpay?.keyId || null,
        keyIdMasked: maskKey(razorpay?.keyId),
        updatedAt: razorpay?.updatedAt || null
      };
    },

    async updateRazorpaySettings(payload, updatedBy) {
      await repository.upsertRazorpaySettings({
        keyId: payload.keyId.trim(),
        keySecretEnc: encryptSecret(payload.keySecret.trim()),
        isActive: payload.isActive,
        updatedBy
      });

      return this.getRazorpaySettings();
    },

    async getIntegrationSettings() {
      const settings = await repository.getPlatformSettings();
      const integrations = settings?.integrations;

      return {
        whatsappProviderKeyMasked: maskSecret(integrations?.whatsappProviderKeyEnc),
        smtp: {
          host: integrations?.smtp?.host || null,
          port: integrations?.smtp?.port || null,
          user: integrations?.smtp?.user || null,
          passMasked: maskSecret(integrations?.smtp?.passwordEnc),
          from: integrations?.smtp?.fromEmail || null
        },
        updatedAt: integrations?.smtp?.updatedAt || null
      };
    },

    async updateIntegrationSettings(payload, updatedBy) {
      const nextPayload = {};

      if (payload.whatsappProviderKey?.trim()) {
        nextPayload.whatsappProviderKeyEnc = encryptSecret(payload.whatsappProviderKey.trim());
      }

      if (payload.smtp) {
        const smtp = {};

        if (payload.smtp.host?.trim()) smtp.host = payload.smtp.host.trim();
        if (payload.smtp.port && payload.smtp.port > 0) smtp.port = payload.smtp.port;
        if (payload.smtp.user?.trim()) smtp.user = payload.smtp.user.trim();
        if (payload.smtp.pass?.trim()) smtp.passwordEnc = encryptSecret(payload.smtp.pass.trim());
        if (payload.smtp.from?.trim()) smtp.fromEmail = payload.smtp.from.trim();

        if (Object.keys(smtp).length > 0) {
          nextPayload.smtp = smtp;
        }
      }

      if (Object.keys(nextPayload).length === 0) {
        return this.getIntegrationSettings();
      }

      nextPayload.updatedBy = updatedBy;
      await repository.upsertIntegrationSettings(nextPayload);
      return this.getIntegrationSettings();
    },

    async getQueueStatus() {
      return getNotificationQueueStatus();
    },

    async createTenant(payload) {
      const academyCode = await generateAcademyCode();
      const planMeta = await resolvePlanMeta(payload.planName);
      const tenant = await repository.createTenant({
        name: payload.academyName,
        ownerName: payload.ownerName,
        academyCode,
        email: (payload.billingEmail || `tenant+${academyCode}@arenapilot.local`).toLowerCase(),
        billingEmail: payload.billingEmail || null,
        subscriptionStatus: payload.subscriptionStatus,
        tenantStatus: payload.tenantStatus,
        paymentStatus: payload.paymentStatus,
        customPriceOverride: payload.customPriceOverride ?? null,
        planEndDate: payload.nextPaymentDate ? new Date(payload.nextPaymentDate) : null,
        ...planMeta
      });

      return mapTenantView(tenant);
    },

    async updateTenant(tenantId, payload) {
      assertValidTenantId(tenantId);
      const existing = await repository.findTenantById(tenantId);
      if (!existing) {
        throw new AppError('Tenant not found', StatusCodes.NOT_FOUND);
      }

      const planMeta = await resolvePlanMeta(payload.planName);
      const updated = await repository.updateTenantById(tenantId, {
        name: payload.academyName,
        ownerName: payload.ownerName,
        billingEmail: payload.billingEmail || null,
        subscriptionStatus: payload.subscriptionStatus,
        tenantStatus: payload.tenantStatus,
        paymentStatus: payload.paymentStatus,
        customPriceOverride: payload.customPriceOverride ?? null,
        planEndDate: payload.nextPaymentDate ? new Date(payload.nextPaymentDate) : null,
        ...planMeta
      });

      return mapTenantView(updated);
    },

    async updateTenantStatus(tenantId, tenantStatus) {
      assertValidTenantId(tenantId);
      const updated = await repository.updateTenantById(tenantId, { tenantStatus });
      if (!updated) {
        throw new AppError('Tenant not found', StatusCodes.NOT_FOUND);
      }
      return mapTenantView(updated);
    },

    async resetTenantAccess(tenantId) {
      assertValidTenantId(tenantId);
      const updated = await repository.resetTenantAccess(tenantId);
      if (!updated) {
        throw new AppError('Tenant not found', StatusCodes.NOT_FOUND);
      }
      return mapTenantView(updated);
    },

    async updateTenantPriceOverride(tenantId, customPriceOverride) {
      assertValidTenantId(tenantId);
      const updated = await repository.updateTenantById(tenantId, { customPriceOverride });
      if (!updated) {
        throw new AppError('Tenant not found', StatusCodes.NOT_FOUND);
      }
      return mapTenantView(updated);
    }
  };
};
