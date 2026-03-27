import { Plan } from '../../models/plan.model.js';
import { TenantBillingPayment } from '../../models/tenantBillingPayment.model.js';

export const tenantRepository = {
  listActivePlans() {
    return Plan.find({ status: 'active' }).sort({ priceMonthly: 1, createdAt: 1 }).lean();
  },

  createBillingPayment(payload) {
    return TenantBillingPayment.create(payload);
  },

  listBillingPayments(tenantId, limit = 12) {
    return TenantBillingPayment.find({ tenantId }).sort({ paymentDate: -1, createdAt: -1 }).limit(limit).lean();
  },

  findBillingPaymentByRazorpayPaymentId(razorpayPaymentId) {
    return TenantBillingPayment.findOne({ razorpayPaymentId }).lean();
  },

  findBillingPaymentByRazorpayOrderId(razorpayOrderId) {
    return TenantBillingPayment.findOne({ razorpayOrderId }).lean();
  },

  findBillingPaymentById(tenantId, paymentId) {
    return TenantBillingPayment.findOne({ _id: paymentId, tenantId }).lean();
  }
};
