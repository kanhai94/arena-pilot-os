import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
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
      default: null,
      index: true
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    messageType: {
      type: String,
      enum: ['feeReminder', 'absence', 'broadcast'],
      required: true,
      index: true
    },
    messageContent: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed'],
      default: 'queued',
      index: true
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastError: {
      type: String,
      default: null
    },
    failedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

notificationSchema.index({ tenantId: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, status: 1 });
notificationSchema.index({ tenantId: 1, retryCount: 1 });
notificationSchema.index({ tenantId: 1, updatedAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
