import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleMiddleware } from '../../middleware/roleMiddleware.js';
import { ROLES } from '../../constants/roles.js';
import { adminRepository } from './admin.repository.js';
import { createAdminService } from './admin.service.js';
import { createAdminController } from './admin.controller.js';

const adminRouter = Router();

const adminService = createAdminService(adminRepository);
const adminController = createAdminController(adminService);

adminRouter.use(authMiddleware, roleMiddleware(ROLES.SUPER_ADMIN));

adminRouter.get('/tenants', adminController.getTenants);
adminRouter.post('/tenant', adminController.createTenant);
adminRouter.patch('/tenant/:id', adminController.updateTenant);
adminRouter.patch('/tenant/:id/status', adminController.updateTenantStatus);
adminRouter.post('/tenant/:id/reset-access', adminController.resetTenantAccess);
adminRouter.patch('/tenant/:id/price-override', adminController.updateTenantPriceOverride);
adminRouter.get('/queue/status', adminController.getQueueStatus);
adminRouter.get('/settings/razorpay', adminController.getRazorpaySettings);
adminRouter.put('/settings/razorpay', adminController.updateRazorpaySettings);

export { adminRouter };
