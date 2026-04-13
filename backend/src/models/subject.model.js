import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
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
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
      index: true
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

subjectSchema.index({ tenantId: 1, classId: 1, status: 1 });
subjectSchema.index({ tenantId: 1, name: 1, classId: 1 });

export const Subject = mongoose.model('Subject', subjectSchema);
