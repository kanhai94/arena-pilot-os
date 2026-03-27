import mongoose from 'mongoose';

const platformRazorpaySchema = new mongoose.Schema(
  {
    keyId: {
      type: String,
      default: null
    },
    keySecretEnc: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: false
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
  { _id: false }
);

const platformIntegrationSmtpSchema = new mongoose.Schema(
  {
    host: {
      type: String,
      default: null
    },
    port: {
      type: Number,
      default: null
    },
    user: {
      type: String,
      default: null
    },
    passwordEnc: {
      type: String,
      default: null
    },
    fromEmail: {
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
  { _id: false }
);

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
    payments: {
      razorpay: {
        type: platformRazorpaySchema,
        default: {}
      }
    },
    integrations: {
      whatsappProviderKeyEnc: {
        type: String,
        default: null
      },
      smtp: {
        type: platformIntegrationSmtpSchema,
        default: {}
      }
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
