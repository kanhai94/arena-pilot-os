import mongoose from 'mongoose';
import { ALL_ROLES } from '../constants/roles.js';
import { ALL_PERMISSIONS } from '../constants/permissions.js';

const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      trim: true,
      default: ''
    },
    designation: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      required: true,
      index: true
    },
    permissions: {
      type: [String],
      enum: ALL_PERMISSIONS,
      default: []
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    versionKey: false
  }
);

userSchema.index({ tenantId: 1, role: 1 });

export const User = mongoose.model('User', userSchema);
