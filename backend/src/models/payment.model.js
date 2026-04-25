import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 1
    },
    month: {
      type: String,
      trim: true,
      required: true,
      index: true
    },
    paymentDate: {
      type: Date,
      required: true,
      index: true
    },
    dueDate: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['PAID', 'PENDING', 'OVERDUE'],
      required: true,
      default: 'PAID',
      index: true
    },
    paymentMode: {
      type: String,
      enum: ['CASH', 'ONLINE', 'UPI', 'cash', 'online', 'upi'],
      required: true
    },
    transactionId: {
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
    },
    paymentSource: {
      type: String,
      enum: ['manual', 'razorpay_webhook'],
      default: 'manual'
    },
    referenceNote: {
      type: String,
      trim: true,
      default: null
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

paymentSchema.index({ tenantId: 1, studentId: 1, paymentDate: -1 });
paymentSchema.index({ tenantId: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, studentId: 1 });
paymentSchema.index({ tenantId: 1, studentId: 1, month: 1 }, { unique: true });
paymentSchema.index({ tenantId: 1, status: 1, dueDate: 1 });
paymentSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $type: 'string' }
    }
  }
);

export const Payment = mongoose.model('Payment', paymentSchema);
