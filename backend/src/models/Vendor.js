const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vendor contact name is required'],
      trim: true
    },
    company: {
      type: String,
      required: [true, 'Company/Firm name is required'],
      trim: true
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
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
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      stateCode: { type: String, default: '07' },
      pincode: { type: String, default: '' }
    },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountNo: { type: String, default: '' },
      ifsc: { type: String, default: '' },
      branch: { type: String, default: '' }
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
vendorSchema.index({ mobile: 1 });
vendorSchema.index({ company: 'text', name: 'text' });
vendorSchema.index({ branchId: 1, isDeleted: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
