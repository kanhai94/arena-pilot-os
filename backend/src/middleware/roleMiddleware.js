import { authorizeRoles } from './authorizeRoles.js';

export const roleMiddleware = (...allowedRoles) => {
  return authorizeRoles(...allowedRoles);
};
