import mongoose from 'mongoose';

const classSchema = new mongoose.Schema(
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
    section: {
      type: String,
      trim: true,
      default: ''
    },
    classTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
      index: true
    },
    strength: {
      type: Number,
      default: 0,
      min: 0
    },
    scheduleDays: {
      type: [String],
      enum: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      default: []
    },
    startTime: {
      type: String,
      trim: true,
      default: ''
    },
    endTime: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

classSchema.index({ tenantId: 1, createdAt: -1 });
classSchema.index({ tenantId: 1, name: 1, section: 1 });
classSchema.index({ tenantId: 1, classTeacherId: 1 });

export const Class = mongoose.model('Class', classSchema);
