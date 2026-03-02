import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true
    },
    priceMonthly: {
      type: Number,
      required: true,
      min: 0
    },
    studentLimit: {
      type: Number,
      required: true,
      min: 1
    },
    features: {
      type: [String],
      default: []
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

export const Plan = mongoose.model('Plan', planSchema);
