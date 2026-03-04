import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
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
    age: {
      type: Number,
      required: true,
      min: 3,
      max: 100
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    parentName: {
      type: String,
      required: true,
      trim: true
    },
    parentPhone: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    normalizedName: {
      type: String,
      trim: true,
      index: true,
      select: false,
      default: null
    },
    normalizedParentPhone: {
      type: String,
      trim: true,
      index: true,
      select: false,
      default: null
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null
    },
    feeStatus: {
      type: String,
      enum: ['paid', 'pending'],
      default: 'pending',
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.normalizedName;
        delete ret.normalizedParentPhone;
        return ret;
      }
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.normalizedName;
        delete ret.normalizedParentPhone;
        return ret;
      }
    }
  }
);

studentSchema.index({ tenantId: 1 });
studentSchema.index({ tenantId: 1, parentPhone: 1 });
studentSchema.index({ tenantId: 1, status: 1 });
studentSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
studentSchema.index({ tenantId: 1, normalizedName: 1, normalizedParentPhone: 1, status: 1 });
studentSchema.index({ tenantId: 1, name: 'text' });

export const Student = mongoose.model('Student', studentSchema);
