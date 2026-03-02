import mongoose from 'mongoose';

const feePlanSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 1
    },
    durationMonths: {
      type: Number,
      required: true,
      min: 1,
      max: 60
    },
    description: {
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

feePlanSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const FeePlan = mongoose.model('FeePlan', feePlanSchema);
