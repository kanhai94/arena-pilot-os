import { TenantContext } from '../../core/context/tenantContext.js';
import { TenantIntegration } from './integration.model.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

export const integrationRepository = {
  getByTenantId(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return TenantIntegration.findOne({ tenantId: scopedTenantId }).lean();
  },

  upsertByTenantId(tenantId, payload) {
    const scopedTenantId = resolveTenantId(tenantId);
    return TenantIntegration.findOneAndUpdate(
      { tenantId: scopedTenantId },
      { $set: payload },
      { new: true, upsert: true, lean: true }
    );
  }
};
