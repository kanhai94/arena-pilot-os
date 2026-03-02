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
    paymentDate: {
      type: Date,
      required: true,
      index: true
    },
    paymentMode: {
      type: String,
      enum: ['cash', 'online', 'upi'],
      required: true
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

export const Payment = mongoose.model('Payment', paymentSchema);
