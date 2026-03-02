import mongoose from 'mongoose';

const platformSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    razorpayKeyId: {
      type: String,
      default: null
    },
    razorpaySecretEncrypted: {
      type: String,
      default: null
    },
    updatedAt: {
      type: Date,
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const PlatformSetting = mongoose.model('PlatformSetting', platformSettingSchema);
