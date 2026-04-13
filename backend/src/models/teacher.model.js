import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema(
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
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

teacherSchema.index({ tenantId: 1, createdAt: -1 });
teacherSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const Teacher = mongoose.model('Teacher', teacherSchema);
