import { Plan } from '../../models/plan.model.js';
import { Subscription } from '../../models/subscription.model.js';
import { Tenant } from '../../models/tenant.model.js';
import { Student } from '../../models/student.model.js';
import { User } from '../../models/user.model.js';
import { Payment } from '../../models/payment.model.js';

export const billingRepository = {
  createPlan(payload) {
    return Plan.create(payload);
  },

  upsertPlanByName(name, payload) {
    return Plan.findOneAndUpdate({ name }, { $set: payload }, { upsert: true, new: true, setDefaultsOnInsert: true, lean: true });
  },

  findPlanById(planId) {
    return Plan.findOne({ _id: planId }).lean();
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

  updateSubscriptionById(tenantId, subscriptionId, updatePayload) {
    return Subscription.findOneAndUpdate(
      { _id: subscriptionId, tenantId },
      { $set: updatePayload },
      { new: true, lean: true }
    );
  },

  cancelAllActiveSubscriptions(tenantId) {
    return Subscription.updateMany(
      { tenantId, status: { $in: ['trial', 'active'] } },
      { $set: { status: 'cancelled', autoRenew: false } }
    );
  },

  updateTenantSubscription(tenantId, payload) {
    return Tenant.findOneAndUpdate({ _id: tenantId }, { $set: payload }, { new: true, lean: true });
  },

  findTenantById(tenantId) {
    return Tenant.findOne({ _id: tenantId }).lean();
  },

  findTenantByIdWithPlan(tenantId) {
    return Tenant.findOne({ _id: tenantId })
      .populate({ path: 'currentPlanId', select: 'name priceMonthly studentLimit features status' })
      .lean();
  },

  countActiveStudents(tenantId) {
    return Student.countDocuments({ tenantId, status: 'active' });
  },

  findPaymentByRazorpayPaymentId(razorpayPaymentId, tenantId = null) {
    const filter = tenantId ? { razorpayPaymentId, tenantId } : { razorpayPaymentId };
    return Payment.findOne(filter).lean();
  },

  createWebhookPayment(payload) {
    return Payment.create(payload);
  },

  findDefaultRecorderUser(tenantId) {
    return User.findOne({
      tenantId,
      role: { $in: ['AcademyAdmin', 'SuperAdmin'] },
      isActive: true
    })
      .select('_id')
      .lean();
  },

  updateTenantPaymentSnapshot(tenantId, payload) {
    return Tenant.updateOne({ _id: tenantId }, { $set: payload });
  }
};
