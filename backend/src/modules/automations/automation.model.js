import mongoose from 'mongoose';

const automationLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    automationType: {
      type: String,
      enum: ['feeReminder', 'absenceAlert', 'broadcast'],
      required: true
    },
    studentsTargeted: {
      type: Number,
      default: 0
    },
    channel: {
      type: String,
      enum: ['email', 'whatsapp', 'both'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed'],
      default: 'queued'
    }
  },
  { timestamps: true }
);

automationLogSchema.index({ tenantId: 1, createdAt: -1 });
automationLogSchema.index({ tenantId: 1, automationType: 1 });

automationLogSchema.set('toJSON', { virtuals: true });
automationLogSchema.set('toObject', { virtuals: true });

export const AutomationLog = mongoose.model('AutomationLog', automationLogSchema);
