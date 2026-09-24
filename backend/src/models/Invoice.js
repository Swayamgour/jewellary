const mongoose = require('mongoose');
const { BILL_TYPES, INVOICE_STATUSES, METALS, PURITIES, MAKING_CHARGE_TYPES } = require('../config/constants');

const invoiceItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    barcode: {
      type: String,
      uppercase: true,
      trim: true
    },
    productName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: ''
    },
    hsnCode: {
      type: String,
      default: '7113'
    },
    metal: {
      type: String,
      enum: Object.values(METALS),
      default: METALS.GOLD
    },
    purity: {
      type: String,
      enum: Object.values(PURITIES),
      default: PURITIES.GOLD_22K
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
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    goldRate: {
      type: Number,
      required: true,
      min: 0
    },
    goldAmount: {
      type: Number,
      required: true,
      min: 0
    },
    makingType: {
      type: String,
      enum: Object.values(MAKING_CHARGE_TYPES),
      default: MAKING_CHARGE_TYPES.PER_GRAM
    },
    makingRate: {
      type: Number,
      default: 0,
      min: 0
    },
    makingAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    wastagePercent: {
      type: Number,
      default: 0,
      min: 0
    },
    wastageAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    stoneAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    taxableAmount: {
      type: Number,
      required: true,
      min: 0
    },
    taxRate: {
      type: Number,
      default: 0
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    billType: {
      type: String,
      enum: Object.values(BILL_TYPES),
      required: true,
      default: BILL_TYPES.KACHA
    },
    invoiceDate: {
      type: Date,
      default: Date.now
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    customerSnapshot: {
      name: { type: String, required: true },
      mobile: { type: String, required: true },
      address: { type: String, default: '' },
      gstin: { type: String, default: '' },
      state: { type: String, default: '' },
      stateCode: { type: String, default: '07' }
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
    items: [invoiceItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    taxableAmount: {
      type: Number,
      required: true,
      min: 0
    },
    tax: {
      isInterState: { type: Boolean, default: false },
      cgstRate: { type: Number, default: 0 },
      cgstAmount: { type: Number, default: 0 },
      sgstRate: { type: Number, default: 0 },
      sgstAmount: { type: Number, default: 0 },
      igstRate: { type: Number, default: 0 },
      igstAmount: { type: Number, default: 0 },
      totalTax: { type: Number, default: 0 }
    },
    roundOff: {
      type: Number,
      default: 0
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0
    },
    paymentSummary: {
      paid: { type: Number, default: 0, min: 0 },
      due: { type: Number, default: 0, min: 0 },
      exchangeAdjusted: { type: Number, default: 0, min: 0 }
    },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUSES),
      default: INVOICE_STATUSES.CONFIRMED
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'PAID'],
      default: 'PENDING'
    },
    convertedFromKachaBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    },
    convertedToPakkaBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    },
    cancellationReason: {
      type: String,
      default: ''
    },
    cancelledAt: {
      type: Date
    },
    cancelledBy: {
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

// Indexes
invoiceSchema.index({ billType: 1, status: 1 });
invoiceSchema.index({ customerId: 1, invoiceDate: -1 });
invoiceSchema.index({ branchId: 1, invoiceDate: -1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ 'items.barcode': 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
