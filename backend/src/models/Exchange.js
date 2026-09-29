const mongoose = require('mongoose');
const { METALS } = require('../config/constants');

const exchangeItemSchema = new mongoose.Schema(
  {
    itemDescription: {
      type: String,
      required: true
    },
    metal: {
      type: String,
      enum: Object.values(METALS),
      default: METALS.GOLD
    },
    purityDeclared: {
      type: String,
      default: '22K'
    },
    testingMethod: {
      type: String,
      enum: ['TOUCHSTONE', 'ACID', 'XRF_SPECTROMETER', 'DENSITY'],
      default: 'TOUCHSTONE'
    },
    purityTestedPercent: {
      type: Number,
      required: true, // e.g. 91.6 for 22K
      min: 0,
      max: 100
    },
    grossWeight: {
      type: Number,
      required: true,
      min: 0
    },
    stoneWeight: {
      type: Number,
      default: 0,
      min: 0
    },
    netWeight: {
      type: Number,
      required: true,
      min: 0
    },
    meltingLossPercent: {
      type: Number,
      default: 0,
      min: 0
    },
    meltingLossWeight: {
      type: Number,
      default: 0,
      min: 0
    },
    pureWeight: {
      type: Number,
      required: true,
      min: 0
    },
    goldRateApplied: {
      type: Number,
      required: true,
      min: 0
    },
    exchangeValue: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: true }
);

const exchangeSchema = new mongoose.Schema(
  {
    exchangeNo: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    exchangeDate: {
      type: Date,
      default: Date.now
    },
    items: [exchangeItemSchema],
    totalGrossWeight: {
      type: Number,
      required: true,
      min: 0
    },
    totalNetWeight: {
      type: Number,
      required: true,
      min: 0
    },
    totalExchangeValue: {
      type: Number,
      required: true,
      min: 0
    },
    // PENDING_ADJUSTMENT   : old gold received, value sits as customer credit
    // PARTIALLY_ADJUSTED   : part of the value used on a bill, rest still credit
    // ADJUSTED_IN_BILL     : fully used against a bill
    // PAID_OUT             : remaining value paid to the customer
    status: {
      type: String,
      enum: ['PENDING_ADJUSTMENT', 'PARTIALLY_ADJUSTED', 'ADJUSTED_IN_BILL', 'PAID_OUT', 'CANCELLED'],
      default: 'PENDING_ADJUSTMENT'
    },
    // Value already used against invoices / paid out
    adjustedAmount: { type: Number, default: 0, min: 0 },
    // Every bill the old-gold value was used against (an exchange may be split over several bills)
    adjustments: [
      {
        invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
        amount: { type: Number, required: true, min: 0 },
        paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
        at: { type: Date, default: Date.now }
      }
    ],
    paidOutAmount: { type: Number, default: 0, min: 0 },
    payoutPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true
    },
    createdBy: {
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

exchangeSchema.index({ customerId: 1, exchangeDate: -1 });
exchangeSchema.index({ branchId: 1, status: 1 });
exchangeSchema.index({ invoiceId: 1 });

module.exports = mongoose.model('Exchange', exchangeSchema);
