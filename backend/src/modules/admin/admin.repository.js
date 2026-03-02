import { env } from '../../config/env.js';
import { Tenant } from '../../models/tenant.model.js';
import { PlatformSetting } from '../../models/platformSetting.model.js';

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
            _id: 0,
            academyName: '$name',
            ownerName: 1,
            planName: { $ifNull: ['$planName', 'Unassigned'] },
            studentCount: 1,
            subscriptionStatus: 1,
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
  }
};
