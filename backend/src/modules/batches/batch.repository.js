import { Batch } from '../../models/batch.model.js';
import { User } from '../../models/user.model.js';
import { FeePlan } from '../../models/feePlan.model.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

export const batchRepository = {
  findCoachById(tenantId, coachId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return User.findOne({ _id: coachId, tenantId: scopedTenantId, role: 'Coach', isActive: true }).lean();
  },

  createBatch(payload) {
    return Batch.create(payload);
  },

  findFeePlanById(tenantId, feePlanId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return FeePlan.findOne({ _id: feePlanId, tenantId: scopedTenantId }).lean();
  },

  async listBatches({ tenantId, coachId, page, limit, status, sportType, centerName }) {
    const scopedTenantId = resolveTenantId(tenantId);
    const filter = { tenantId: scopedTenantId };

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
    const scopedTenantId = resolveTenantId(tenantId);
    const filter = { _id: batchId, tenantId: scopedTenantId };

    if (coachId) {
      filter.coachId = coachId;
    }

    return Batch.findOne(filter).lean();
  },

  updateBatchById(tenantId, batchId, updatePayload) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Batch.findOneAndUpdate({ _id: batchId, tenantId: scopedTenantId }, { $set: updatePayload }, { new: true, lean: true });
  },

  deactivateBatchById(tenantId, batchId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Batch.findOneAndUpdate(
      { _id: batchId, tenantId: scopedTenantId, status: 'active' },
      { $set: { status: 'inactive' } },
      { new: true, lean: true }
    );
  }
};
