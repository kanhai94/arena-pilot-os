import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema(
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
    centerName: {
      type: String,
      required: true,
      trim: true,
      default: 'Main Center'
    },
    feePlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeePlan',
      default: null,
      index: true
    },
    sportType: {
      type: String,
      required: true,
      trim: true
    },
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
      index: true
    },
    scheduleDays: {
      type: [String],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'scheduleDays must contain at least one day'
      }
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 1000
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

batchSchema.index({ tenantId: 1, coachId: 1, status: 1 });
batchSchema.index({ tenantId: 1, centerName: 1, status: 1 });
batchSchema.index({ tenantId: 1, feePlanId: 1, status: 1 });
batchSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const Batch = mongoose.model('Batch', batchSchema);
