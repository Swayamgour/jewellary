const mongoose = require('mongoose');
const { PAYMENT_MODES } = require('../config/constants');

const expenseSchema = new mongoose.Schema(
  {
    expenseNo: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    title: {
      type: String,
      required: [true, 'Expense title is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Expense category is required'],
      uppercase: true,
      trim: true
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero']
    },
    paymentMode: {
      type: String,
      enum: Object.values(PAYMENT_MODES),
      default: PAYMENT_MODES.CASH
    },
    paymentReference: {
      type: String,
      default: ''
    },
    expenseDate: {
      type: Date,
      default: Date.now
    },
    attachmentUrl: {
      type: String,
      default: ''
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

expenseSchema.index({ branchId: 1, expenseDate: -1 });
expenseSchema.index({ category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
