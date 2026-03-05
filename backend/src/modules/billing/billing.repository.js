import { Plan } from '../../models/plan.model.js';
import { Subscription } from '../../models/subscription.model.js';
import { Tenant } from '../../models/tenant.model.js';
import { Student } from '../../models/student.model.js';
import { User } from '../../models/user.model.js';
import { Payment } from '../../models/payment.model.js';
import { TenantContext } from '../../core/context/tenantContext.js';
import { ROLES } from '../../constants/roles.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

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
    const scopedTenantId = resolveTenantId(tenantId);
    return Subscription.findOne({
      tenantId: scopedTenantId,
      status: { $in: ['trial', 'active', 'expired'] }
    })
      .sort({ createdAt: -1 })
      .lean();
  },

  async findLatestSubscription(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Subscription.findOne({ tenantId: scopedTenantId }).sort({ createdAt: -1 }).lean();
  },

  updateSubscriptionById(tenantId, subscriptionId, updatePayload) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Subscription.findOneAndUpdate(
      { _id: subscriptionId, tenantId: scopedTenantId },
      { $set: updatePayload },
      { new: true, lean: true }
    );
  },

  cancelAllActiveSubscriptions(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Subscription.updateMany(
      { tenantId: scopedTenantId, status: { $in: ['trial', 'active'] } },
      { $set: { status: 'cancelled', autoRenew: false } }
    );
  },

  updateTenantSubscription(tenantId, payload) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Tenant.findOneAndUpdate({ _id: scopedTenantId }, { $set: payload }, { new: true, lean: true });
  },

  findTenantById(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Tenant.findOne({ _id: scopedTenantId }).lean();
  },

  findTenantByIdWithPlan(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Tenant.findOne({ _id: scopedTenantId })
      .populate({ path: 'currentPlanId', select: 'name priceMonthly studentLimit features status' })
      .lean();
  },

  countActiveStudents(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Student.countDocuments({ tenantId: scopedTenantId, status: 'active' });
  },

  findPaymentByRazorpayPaymentId(razorpayPaymentId, tenantId = null) {
    const filter = tenantId ? { razorpayPaymentId, tenantId } : { razorpayPaymentId };
    return Payment.findOne(filter).lean();
  },

  createWebhookPayment(payload) {
    return Payment.create(payload);
  },

  findDefaultRecorderUser(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return User.findOne({
      tenantId: scopedTenantId,
      role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN, 'AcademyAdmin', 'SuperAdmin'] },
      isActive: true
    })
      .select('_id')
      .lean();
  },

  updateTenantPaymentSnapshot(tenantId, payload) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Tenant.updateOne({ _id: scopedTenantId }, { $set: payload });
  }
};
