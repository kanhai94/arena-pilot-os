import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { ROLES } from '../../constants/roles.js';
import { TenantContext } from '../../core/context/tenantContext.js';

export const createBatchService = (repository) => {
  const resolveTenantId = () => TenantContext.requireTenantId();
  return {
    async createBatch(payload) {
      const tenantId = resolveTenantId();
      const [coach, feePlan] = await Promise.all([
        payload.coachId ? repository.findCoachById(tenantId, payload.coachId) : Promise.resolve(null),
        payload.feePlanId ? repository.findFeePlanById(tenantId, payload.feePlanId) : Promise.resolve(null)
      ]);
      if (payload.coachId && !coach) {
        throw new AppError('Coach not found in tenant', StatusCodes.BAD_REQUEST);
      }
      if (payload.feePlanId && !feePlan) {
        throw new AppError('Fee plan not found in tenant', StatusCodes.BAD_REQUEST);
      }

      try {
        return await repository.createBatch({
          ...payload,
          tenantId,
          centerName: payload.centerName?.trim() || 'Main Center',
          coachId: payload.coachId || null,
          feePlanId: payload.feePlanId || null
        });
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError('Batch name already exists in tenant', StatusCodes.CONFLICT);
        }
        throw error;
      }
    },

    async listBatches(auth, query) {
      const tenantId = resolveTenantId();
      const { page, limit, status, sportType, centerName } = query;
      const coachScopedId = auth.role === ROLES.COACH ? auth.userId : null;

      const { items, total } = await repository.listBatches({
        tenantId,
        coachId: coachScopedId,
        page,
        limit,
        status,
        sportType,
        centerName
      });

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

    async updateBatch(batchId, payload) {
      const tenantId = resolveTenantId();
      if (payload.coachId || payload.feePlanId) {
        const [coach, feePlan] = await Promise.all([
          payload.coachId ? repository.findCoachById(tenantId, payload.coachId) : Promise.resolve(true),
          payload.feePlanId ? repository.findFeePlanById(tenantId, payload.feePlanId) : Promise.resolve(true)
        ]);
        if (!coach) {
          throw new AppError('Coach not found in tenant', StatusCodes.BAD_REQUEST);
        }
        if (!feePlan) {
          throw new AppError('Fee plan not found in tenant', StatusCodes.BAD_REQUEST);
        }
      }

      try {
        const updated = await repository.updateBatchById(tenantId, batchId, {
          ...payload,
          ...(payload.centerName ? { centerName: payload.centerName.trim() } : {}),
          ...(Object.prototype.hasOwnProperty.call(payload, 'feePlanId')
            ? { feePlanId: payload.feePlanId || null }
            : {})
        });
        if (!updated) {
          throw new AppError('Batch not found', StatusCodes.NOT_FOUND);
        }
        return updated;
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError('Batch name already exists in tenant', StatusCodes.CONFLICT);
        }
        throw error;
      }
    },

    async deactivateBatch(batchId) {
      const tenantId = resolveTenantId();
      const deactivated = await repository.deactivateBatchById(tenantId, batchId);
      if (deactivated) {
        return deactivated;
      }

      const existing = await repository.findBatchById(tenantId, batchId);
      if (!existing) {
        throw new AppError('Batch not found', StatusCodes.NOT_FOUND);
      }

      return existing;
    }
  };
};
