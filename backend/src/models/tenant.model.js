import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    academyCode: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    ownerName: {
      type: String,
      required: true,
      trim: true
    },
    academySize: {
      type: Number,
      default: null,
      min: 1
    },
    requestedPlanName: {
      type: String,
      enum: ['Starter', 'Growth', 'Pro'],
      default: 'Starter'
    },
    tenantStatus: {
      type: String,
      enum: ['active', 'blocked', 'suspended'],
      default: 'active',
      index: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true
    },
    subscriptionStatus: {
      type: String,
      enum: ['trial', 'active', 'expired', 'suspended', 'cancelled'],
      default: 'trial',
      index: true
    },
    currentPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
      index: true
    },
    customPriceOverride: {
      type: Number,
      default: null,
      min: 0
    },
    billingEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    razorpayCustomerId: {
      type: String,
      trim: true,
      default: null
    },
    lastPaymentDate: {
      type: Date,
      default: null
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'failed'],
      default: 'pending',
      index: true
    },
    planName: {
      type: String,
      trim: true,
      default: null
    },
    studentLimit: {
      type: Number,
      default: null,
      validate: {
        validator: (value) => value === null || (Number.isInteger(value) && value >= 1),
        message: 'studentLimit must be null (unlimited) or an integer >= 1'
      }
    },
    planStartDate: {
      type: Date,
      default: null
    },
    planEndDate: {
      type: Date,
      default: null
    },
    totalStudents: {
      type: Number,
      default: 0,
      min: 0
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    lastActivityAt: {
      type: Date,
      default: null
    },
    metricsMonth: {
      type: String,
      default: () => {
        const now = new Date();
        return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      },
      index: true
    },
    attendanceCountThisMonth: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentsRecordedThisMonth: {
      type: Number,
      default: 0,
      min: 0
    },
    remindersSentThisMonth: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    versionKey: false
  }
);

tenantSchema.index({ tenantStatus: 1, subscriptionStatus: 1, metricsMonth: 1 });
tenantSchema.index({ tenantStatus: 1 });
tenantSchema.index({ subscriptionStatus: 1 });
tenantSchema.index({ createdAt: -1 });
tenantSchema.index({ lastActivityAt: -1 });

export const Tenant = mongoose.model('Tenant', tenantSchema);
