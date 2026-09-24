const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true
    },
    code: {
      type: String,
      required: [true, 'Branch code is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, required: true },
      stateCode: { type: String, default: '07' }, // e.g., '07' for Delhi, '27' for Maharashtra
      pincode: { type: String, default: '' }
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    gstin: {
      type: String,
      uppercase: true,
      trim: true
    },
    isHeadOffice: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

branchSchema.index({ isActive: 1, isDeleted: 1 });

module.exports = mongoose.model('Branch', branchSchema);
