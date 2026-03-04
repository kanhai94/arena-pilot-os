import { env } from '../../config/env.js';
import { Counter } from '../../models/counter.model.js';
import { Plan } from '../../models/plan.model.js';
import { Tenant } from '../../models/tenant.model.js';
import { PlatformSetting } from '../../models/platformSetting.model.js';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { User } from '../../models/user.model.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const adminRepository = {
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
          $addFields: {
            studentCount: {
              $ifNull: [{ $arrayElemAt: ['$studentStats.count', 0] }, 0]
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
            paymentStatus: { $ifNull: ['$paymentStatus', 'pending'] },
            customPriceOverride: { $ifNull: ['$customPriceOverride', null] },
            nextPaymentDate: { $ifNull: ['$planEndDate', null] },
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

  getPlatformSettings() {
    return PlatformSetting.findOne({ key: 'platform' }).lean();
  },

  upsertRazorpaySettings(payload) {
    return PlatformSetting.findOneAndUpdate(
      { key: 'platform' },
      {
        $set: {
          key: 'platform',
          'payments.razorpay.keyId': payload.keyId,
          'payments.razorpay.keySecretEnc': payload.keySecretEnc,
          'payments.razorpay.isActive': payload.isActive,
          'payments.razorpay.updatedAt': new Date(),
          'payments.razorpay.updatedBy': payload.updatedBy
        }
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
