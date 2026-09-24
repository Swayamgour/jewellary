const mongoose = require('mongoose');
const { PAYMENT_MODES, PAYMENT_STATUSES } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
  {
    paymentNo: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    referenceType: {
      type: String,
      enum: ['INVOICE', 'PURCHASE', 'ORDER', 'EXCHANGE', 'ADVANCE', 'DIRECT'],
      required: true
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false
    },
    entityType: {
      type: String,
      enum: ['CUSTOMER', 'VENDOR'],
      required: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be greater than zero']
    },
    paymentDate: {
      type: Date,
      default: Date.now
    },
    paymentMode: {
      type: String,
      enum: Object.values(PAYMENT_MODES),
      required: true,
      default: PAYMENT_MODES.CASH
    },
    modeDetails: {
      transactionId: { type: String, default: '' },
      upiId: { type: String, default: '' },
      cardLast4: { type: String, default: '' },
      bankName: { type: String, default: '' },
      chequeNo: { type: String, default: '' },
      chequeDate: { type: Date }
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
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      default: PAYMENT_STATUSES.SUCCESS
    },
    reversalReason: {
      type: String,
      default: ''
    },
    reversedAt: {
      type: Date
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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

paymentSchema.index({ referenceId: 1, referenceType: 1 });
paymentSchema.index({ entityId: 1, entityType: 1, paymentDate: -1 });
paymentSchema.index({ branchId: 1, paymentDate: -1 });
paymentSchema.index({ paymentMode: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
