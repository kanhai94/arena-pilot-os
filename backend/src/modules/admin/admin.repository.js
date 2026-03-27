import { env } from '../../config/env.js';
import { Counter } from '../../models/counter.model.js';
import { Plan } from '../../models/plan.model.js';
import { Student } from '../../models/student.model.js';
import { Tenant } from '../../models/tenant.model.js';
import { TenantBillingPayment } from '../../models/tenantBillingPayment.model.js';
import { PlatformSetting } from '../../models/platformSetting.model.js';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { User } from '../../models/user.model.js';
import mongoose from 'mongoose';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const adminRepository = {
  listPlans() {
    return Plan.find({}).sort({ createdAt: 1 }).lean();
  },

  findPlanByIdentifier(identifier) {
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    const orConditions = [{ name: { $regex: `^${escapeRegex(identifier)}$`, $options: 'i' } }];
    if (isObjectId) {
      orConditions.unshift({ _id: identifier });
    }
    return Plan.findOne({
      $or: orConditions
    }).lean();
  },

  updatePlanById(planId, payload) {
    return Plan.findOneAndUpdate({ _id: planId }, { $set: payload }, { new: true, lean: true });
  },

  async listTenantsWithStudentCount({ plan, status, page, limit }) {
    const match = {
      email: { $ne: env.SUPER_ADMIN_EMAIL.toLowerCase() }
    };

    if (plan) {
      match.planName = { $regex: `^${escapeRegex(plan)}$`, $options: 'i' };
    }

    if (status) {
      match.subscriptionStatus = status;
    }

    const skip = (page - 1) * limit;

    const [items, countRows] = await Promise.all([
      Tenant.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'students',
            let: { tenantId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$tenantId', '$$tenantId'] }, { $eq: ['$status', 'active'] }]
                  }
                }
              },
              { $count: 'count' }
            ],
            as: 'studentStats'
          }
        },
        {
          $lookup: {
            from: 'tenantbillingpayments',
            let: { tenantId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$tenantId', '$$tenantId'] }, { $eq: ['$status', 'paid'] }]
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  totalPaidAmount: { $sum: '$amount' },
                  lastPaymentDate: { $max: '$paymentDate' }
                }
              }
            ],
            as: 'billingStats'
          }
        },
        {
          $addFields: {
            studentCount: {
              $ifNull: [{ $arrayElemAt: ['$studentStats.count', 0] }, 0]
            },
            billingTotalPaidAmount: {
              $ifNull: [{ $arrayElemAt: ['$billingStats.totalPaidAmount', 0] }, 0]
            },
            billingLastPaymentDate: {
              $ifNull: [{ $arrayElemAt: ['$billingStats.lastPaymentDate', 0] }, null]
            }
          }
        },
        {
          $project: {
            id: { $toString: '$_id' },
            academyName: '$name',
            ownerName: 1,
            planName: { $ifNull: ['$planName', 'Unassigned'] },
            workspaceId: { $ifNull: ['$academyCode', null] },
            academyCode: { $ifNull: ['$academyCode', null] },
            billingEmail: { $ifNull: ['$billingEmail', null] },
            studentCount: 1,
            subscriptionStatus: 1,
            tenantStatus: { $ifNull: ['$tenantStatus', 'active'] },
            paymentStatus: {
              $cond: [
                { $eq: ['$paymentStatus', 'paid'] },
                'paid',
                {
                  $cond: [
                    { $in: ['$subscriptionStatus', ['active', 'trial']] },
                    'paid',
                    { $ifNull: ['$paymentStatus', 'pending'] }
                  ]
                }
              ]
            },
            customPriceOverride: { $ifNull: ['$customPriceOverride', null] },
            planStartDate: { $ifNull: ['$planStartDate', null] },
            lastPaymentDate: { $ifNull: ['$lastPaymentDate', '$billingLastPaymentDate'] },
            nextPaymentDate: { $ifNull: ['$planEndDate', null] },
            totalPaidAmount: {
              $let: {
                vars: {
                  billingTotal: { $ifNull: ['$billingTotalPaidAmount', 0] },
                  tenantTotal: { $ifNull: ['$totalPaidAmount', 0] }
                },
                in: {
                  $cond: [{ $gt: ['$$tenantTotal', '$$billingTotal'] }, '$$tenantTotal', '$$billingTotal']
                }
              }
            },
            createdAt: 1
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]),
      Tenant.aggregate([{ $match: match }, { $count: 'total' }])
    ]);

    return {
      items,
      total: countRows[0]?.total || 0
    };
  },

  async getBillingSummary({ monthStart, nextMonthStart }) {
    const [studentRows, monthlyRows, activeSubscriptions, failedPayments] = await Promise.all([
      Student.aggregate([{ $match: { status: 'active' } }, { $count: 'total' }]),
      TenantBillingPayment.aggregate([
        {
          $match: {
            status: 'paid',
            paymentDate: { $gte: monthStart, $lt: nextMonthStart }
          }
        },
        {
          $group: {
            _id: null,
            monthlyRevenue: { $sum: '$amount' }
          }
        }
      ]),
      Tenant.countDocuments({
        email: { $ne: env.SUPER_ADMIN_EMAIL.toLowerCase() },
        paymentStatus: 'paid',
        subscriptionStatus: { $in: ['active', 'trial'] }
      }),
      Tenant.countDocuments({
        email: { $ne: env.SUPER_ADMIN_EMAIL.toLowerCase() },
        paymentStatus: 'failed'
      })
    ]);

    return {
      totalStudents: studentRows[0]?.total || 0,
      totalClients: studentRows[0]?.total || 0,
      monthlyRevenue: monthlyRows[0]?.monthlyRevenue || 0,
      activeSubscriptions,
      failedPayments
    };
  },

  getPlatformSettings() {
    return PlatformSetting.findOne({ key: 'platform' }).lean();
  },

  upsertRazorpaySettings(payload) {
    const set = {
      key: 'platform',
      'payments.razorpay.keyId': payload.keyId,
      'payments.razorpay.keySecretEnc': payload.keySecretEnc,
      'payments.razorpay.isActive': payload.isActive,
      'payments.razorpay.updatedAt': new Date(),
      'payments.razorpay.updatedBy': payload.updatedBy,
      razorpayKeyId: payload.keyId,
      razorpaySecretEncrypted: payload.keySecretEnc
    };

    return PlatformSetting.findOneAndUpdate(
      { key: 'platform' },
      {
        $set: set
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
    );
  },

  upsertIntegrationSettings(payload) {
    const set = { key: 'platform' };

    if (payload.whatsappProviderKeyEnc) {
      set['integrations.whatsappProviderKeyEnc'] = payload.whatsappProviderKeyEnc;
    }

    if (payload.smtp) {
      if (payload.smtp.host !== undefined) {
        set['integrations.smtp.host'] = payload.smtp.host;
      }
      if (payload.smtp.port !== undefined) {
        set['integrations.smtp.port'] = payload.smtp.port;
      }
      if (payload.smtp.user !== undefined) {
        set['integrations.smtp.user'] = payload.smtp.user;
      }
      if (payload.smtp.passwordEnc !== undefined) {
        set['integrations.smtp.passwordEnc'] = payload.smtp.passwordEnc;
      }
      if (payload.smtp.fromEmail !== undefined) {
        set['integrations.smtp.fromEmail'] = payload.smtp.fromEmail;
      }
      set['integrations.smtp.updatedAt'] = new Date();
      set['integrations.smtp.updatedBy'] = payload.updatedBy;
    }

    return PlatformSetting.findOneAndUpdate(
      { key: 'platform' },
      {
        $set: set
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
    );
  },

  async getNextAcademySequence() {
    const counter = await Counter.findOneAndUpdate(
      { name: 'academy_code' },
      { $inc: { lastValue: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
    );

    return counter.lastValue;
  },

  findPlanByName(name) {
    return Plan.findOne({ name }).lean();
  },

  createTenant(payload) {
    return Tenant.create(payload);
  },

  updateTenantById(tenantId, payload) {
    return Tenant.findOneAndUpdate({ _id: tenantId }, { $set: payload }, { new: true, lean: true });
  },

  findTenantById(tenantId) {
    return Tenant.findOne({ _id: tenantId }).lean();
  },

  async resetTenantAccess(tenantId) {
    const userIds = await User.find({ tenantId }).select('_id').lean();
    const idList = userIds.map((user) => user._id);
    if (idList.length > 0) {
      await RefreshToken.updateMany({ userId: { $in: idList }, tenantId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    }

    return Tenant.findOneAndUpdate({ _id: tenantId }, { $set: { tenantStatus: 'active' } }, { new: true, lean: true });
  }
};
