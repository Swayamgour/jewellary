const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },
    mobile: {
      type: String,
      required: [true, 'Customer mobile is required'],
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      stateCode: { type: String, default: '07' },
      pincode: { type: String, default: '' }
    },
    gstin: {
      type: String,
      uppercase: true,
      trim: true
    },
    pan: {
      type: String,
      uppercase: true,
      trim: true
    },
    openingBalance: {
      type: Number,
      default: 0
    },
    currentBalance: {
      type: Number,
      default: 0
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true
    },
    notes: {
      type: String,
      default: ''
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

// Indexes
customerSchema.index({ mobile: 1 });
customerSchema.index({ name: 'text', mobile: 'text' });
customerSchema.index({ branchId: 1, isDeleted: 1 });

module.exports = mongoose.model('Customer', customerSchema);
