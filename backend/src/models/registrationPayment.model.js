import mongoose from 'mongoose';

const registrationPaymentSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      trim: true,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    academyEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      trim: true
    },
    razorpaySignature: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['created', 'captured', 'failed'],
      default: 'created',
      index: true
    },
    paidAt: {
      type: Date,
      default: null
    },
    consumedAt: {
      type: Date,
      default: null
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

registrationPaymentSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $type: 'string' }
    }
  }
);

export const RegistrationPayment = mongoose.model('RegistrationPayment', registrationPaymentSchema);
