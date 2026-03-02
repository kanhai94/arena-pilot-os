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
      default: null,
      validate: {
        validator: (value) => value === null || (Number.isInteger(value) && value >= 1),
        message: 'studentLimit must be null (unlimited) or an integer >= 1'
      }
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
