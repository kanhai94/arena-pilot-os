export const createSubscriptionService = (dependencies) => {
  const { billingService } = dependencies;

  return {
    getCurrent(tenantId) {
      return billingService.getCurrentUsage(tenantId);
    }
  };
};
