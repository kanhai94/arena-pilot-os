import mongoose from 'mongoose';

const authOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    purpose: {
      type: String,
      enum: ['signup', 'forgotPassword'],
      required: true,
      index: true
    },
    codeHash: {
      type: String,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    verifiedAt: {
      type: Date,
      default: null,
      index: true
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

authOtpSchema.index({ email: 1, purpose: 1, createdAt: -1 });

export const AuthOtp = mongoose.model('AuthOtp', authOtpSchema);
