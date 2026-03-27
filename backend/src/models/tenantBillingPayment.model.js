import mongoose from 'mongoose';

const tenantBillingPaymentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
      index: true
    },
    planName: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly'
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'failed'],
      default: 'pending',
      index: true
    },
    paymentDate: {
      type: Date,
      default: null,
      index: true
    },
    nextPaymentDate: {
      type: Date,
      default: null
    },
    autoRenew: {
      type: Boolean,
      default: false
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    invoiceLabel: {
      type: String,
      trim: true,
      default: null
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      default: null
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      default: null
    },
    razorpaySignature: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

tenantBillingPaymentSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $type: 'string' }
    }
  }
);

tenantBillingPaymentSchema.index({ tenantId: 1, paymentDate: -1 });

export const TenantBillingPayment = mongoose.model('TenantBillingPayment', tenantBillingPaymentSchema);
