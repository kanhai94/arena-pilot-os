import { Plan } from '../../models/plan.model.js';
import { Subscription } from '../../models/subscription.model.js';
import { Tenant } from '../../models/tenant.model.js';
import { Student } from '../../models/student.model.js';

export const billingRepository = {
  createPlan(payload) {
    return Plan.create(payload);
  },

  findPlanById(planId) {
    return Plan.findById(planId).lean();
  },

  findPlanByName(name) {
    return Plan.findOne({ name }).lean();
  },

  findLowestActivePlan() {
    return Plan.findOne({ status: 'active' }).sort({ priceMonthly: 1 }).lean();
  },

  createSubscription(payload) {
    return Subscription.create(payload);
  },

  async findCurrentSubscription(tenantId) {
    return Subscription.findOne({
      tenantId,
      status: { $in: ['trial', 'active', 'expired'] }
    })
      .sort({ createdAt: -1 })
      .lean();
  },

  updateSubscriptionById(subscriptionId, updatePayload) {
    return Subscription.findByIdAndUpdate(subscriptionId, { $set: updatePayload }, { new: true, lean: true });
  },

  cancelAllActiveSubscriptions(tenantId) {
    return Subscription.updateMany(
      { tenantId, status: { $in: ['trial', 'active'] } },
      { $set: { status: 'cancelled', autoRenew: false } }
    );
  },

  updateTenantSubscription(tenantId, payload) {
    return Tenant.findByIdAndUpdate(tenantId, { $set: payload }, { new: true, lean: true });
  },

  findTenantById(tenantId) {
    return Tenant.findById(tenantId).lean();
  },

  countActiveStudents(tenantId) {
    return Student.countDocuments({ tenantId, status: 'active' });
  }
};
