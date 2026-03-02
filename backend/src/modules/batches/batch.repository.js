import { Batch } from '../../models/batch.model.js';
import { User } from '../../models/user.model.js';
import { FeePlan } from '../../models/feePlan.model.js';

export const batchRepository = {
  findCoachById(tenantId, coachId) {
    return User.findOne({ _id: coachId, tenantId, role: 'Coach', isActive: true }).lean();
  },

  createBatch(payload) {
    return Batch.create(payload);
  },

  findFeePlanById(tenantId, feePlanId) {
    return FeePlan.findOne({ _id: feePlanId, tenantId }).lean();
  },

  async listBatches({ tenantId, coachId, page, limit, status, sportType, centerName }) {
    const filter = { tenantId };

    if (coachId) {
      filter.coachId = coachId;
    }
    if (status) {
      filter.status = status;
    }
    if (sportType) {
      filter.sportType = sportType;
    }
    if (centerName) {
      filter.centerName = centerName;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Batch.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'coachId', select: '_id fullName email role', options: { lean: true } })
        .populate({ path: 'feePlanId', select: '_id name amount durationMonths', options: { lean: true } })
        .lean(),
      Batch.countDocuments(filter)
    ]);

    return { items, total };
  },

  findBatchById(tenantId, batchId, coachId = null) {
    const filter = { _id: batchId, tenantId };

    if (coachId) {
      filter.coachId = coachId;
    }

    return Batch.findOne(filter).lean();
  },

  updateBatchById(tenantId, batchId, updatePayload) {
    return Batch.findOneAndUpdate({ _id: batchId, tenantId }, { $set: updatePayload }, { new: true, lean: true });
  },

  deactivateBatchById(tenantId, batchId) {
    return Batch.findOneAndUpdate(
      { _id: batchId, tenantId, status: 'active' },
      { $set: { status: 'inactive' } },
      { new: true, lean: true }
    );
  }
};
