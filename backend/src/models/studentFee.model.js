import mongoose from 'mongoose';

const studentFeeSchema = new mongoose.Schema(
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
    feePlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeePlan',
      required: true,
      index: true
    },
    startDate: {
      type: Date,
      required: true
    },
    nextDueDate: {
      type: Date,
      required: true,
      index: true
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

studentFeeSchema.index(
  { tenantId: 1, studentId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
studentFeeSchema.index({ tenantId: 1, nextDueDate: 1, status: 1 });

export const StudentFee = mongoose.model('StudentFee', studentFeeSchema);
