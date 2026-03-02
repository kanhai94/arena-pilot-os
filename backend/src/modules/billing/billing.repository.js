import { Plan } from '../../models/plan.model.js';
import { Subscription } from '../../models/subscription.model.js';
import { Tenant } from '../../models/tenant.model.js';
import { Student } from '../../models/student.model.js';

export const billingRepository = {
  createPlan(payload) {
    return Plan.create(payload);
  },

  upsertPlanByName(name, payload) {
    return Plan.findOneAndUpdate({ name }, { $set: payload }, { upsert: true, new: true, setDefaultsOnInsert: true, lean: true });
  },

  findPlanById(planId) {
    return Plan.findById(planId).lean();
  },

  findPlanByName(name) {
    return Plan.findOne({ name }).lean();
  },

  findActivePlanByName(name) {
    return Plan.findOne({ name, status: 'active' }).lean();
  },

  findLowestActivePlan() {
    return Plan.findOne({ status: 'active' }).sort({ priceMonthly: 1 }).lean();
  },

  findPlansByNames(names) {
    return Plan.find({ name: { $in: names } }).lean();
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

  async findLatestSubscription(tenantId) {
    return Subscription.findOne({ tenantId }).sort({ createdAt: -1 }).lean();
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

  findTenantByIdWithPlan(tenantId) {
    return Tenant.findById(tenantId).populate({ path: 'currentPlanId', select: 'name priceMonthly studentLimit features status' }).lean();
  },

  countActiveStudents(tenantId) {
    return Student.countDocuments({ tenantId, status: 'active' });
  }
};
