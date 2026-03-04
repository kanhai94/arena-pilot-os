import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

const normalizeTenantId = (tenantId) => {
  if (!tenantId) return null;
  return String(tenantId);
};

export const TenantContext = {
  run(tenantId, callback) {
    return storage.run({ tenantId: normalizeTenantId(tenantId) }, callback);
  },

  setTenantId(tenantId) {
    const store = storage.getStore();
    if (!store) return;
    store.tenantId = normalizeTenantId(tenantId);
  },

  getTenantId() {
    const store = storage.getStore();
    return store ? store.tenantId : null;
  },

  requireTenantId(explicitTenantId = null) {
    const resolved = normalizeTenantId(explicitTenantId) || this.getTenantId();
    if (!resolved) {
      throw new Error('TenantContext: tenantId is missing');
    }
    return resolved;
  },

  runWithTenant(tenantId, callback) {
    return this.run(tenantId, callback);
  }
};

