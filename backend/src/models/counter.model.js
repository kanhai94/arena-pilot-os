import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    lastValue: {
      type: Number,
      required: true,
      default: 0
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

export const Counter = mongoose.model('Counter', counterSchema);
