import { TenantContext } from '../core/context/tenantContext.js';

export const tenantContextMiddleware = (req, _res, next) => {
  const tenantId = req.tenantId || req.auth?.tenantId || null;

  TenantContext.run(tenantId, () => {
    next();
  });
};

