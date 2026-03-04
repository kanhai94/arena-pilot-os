import { TenantContext } from '../../core/context/tenantContext.js';

export const createSubscriptionService = (dependencies) => {
  const { billingService } = dependencies;
  const resolveTenantId = () => TenantContext.requireTenantId();

  return {
    getCurrent() {
      const tenantId = resolveTenantId();
      return billingService.getCurrentUsage(tenantId);
    }
  };
};
