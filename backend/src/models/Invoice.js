const mongoose = require('mongoose');
const { BILL_TYPES, INVOICE_STATUSES, METALS, PURITIES, MAKING_CHARGE_TYPES } = require('../config/constants');

const invoiceItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory'
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
    // Line value after item discount (before the invoice-level discount)
    taxableAmount: {
      type: Number,
      required: true,
      min: 0
    },
    // Line value after its share of the invoice-level discount - the base GST is charged on
    effectiveTaxableAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    taxRate: {
      type: Number,
      default: 0
    },
    // This line's share of the invoice GST
    taxAmount: {
      type: Number,
      default: 0
    },
    // effectiveTaxableAmount + taxAmount (what the customer effectively pays for the line)
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    // Cost snapshot taken from inventory at sale time (drives real gross profit)
    unitCost: {
      type: Number,
      default: 0,
      min: 0
    },
    costAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    // Sales-return tracking (prevents duplicate / excess returns)
    returnedQty: {
      type: Number,
      default: 0,
      min: 0
    },
    returnedTaxable: {
      type: Number,
      default: 0,
      min: 0
    },
    returnedTax: {
      type: Number,
      default: 0,
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
    // Total discount = sum(item discounts) + extraDiscount
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    // Invoice-level discount only (needed to recompute GST correctly on Kacha -> Pakka)
    extraDiscount: {
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
    // Derived from Payment documents by InvoiceAccounting.recompute() - never edited by hand.
    paymentSummary: {
      paid: { type: Number, default: 0, min: 0 }, // total received (incl. old-gold adjustments)
      due: { type: Number, default: 0, min: 0 }, // still receivable after returns
      exchangeAdjusted: { type: Number, default: 0, min: 0 },
      refunded: { type: Number, default: 0, min: 0 }, // money paid back to the customer
      netPayable: { type: Number, default: 0, min: 0 }, // grandTotal - returnedAmount
      excessReceived: { type: Number, default: 0, min: 0 } // received beyond netPayable (customer credit)
    },
    returnedAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    returnedTaxable: {
      type: Number,
      default: 0,
      min: 0
    },
    returnStatus: {
      type: String,
      enum: ['NONE', 'PARTIAL', 'FULL'],
      default: 'NONE'
    },
    confirmedAt: {
      type: Date
    },
    convertedAt: {
      type: Date
    },
    cancellationSummary: {
      paymentAction: { type: String, enum: ['REFUND', 'CREDIT', 'NONE'] },
      receivableReversed: { type: Number, default: 0 },
      cashRefunded: { type: Number, default: 0 },
      creditRetained: { type: Number, default: 0 }
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
    timestamps: true,
    optimisticConcurrency: true
  }
);

// Indexes
// A Kacha bill can be converted at most once, and a Pakka bill can originate from at most one Kacha bill
invoiceSchema.index({ convertedFromKachaBillId: 1 }, { unique: true, sparse: true });
invoiceSchema.index({ convertedToPakkaBillId: 1 }, { unique: true, sparse: true });
invoiceSchema.index({ billType: 1, status: 1 });
invoiceSchema.index({ customerId: 1, invoiceDate: -1 });
invoiceSchema.index({ branchId: 1, invoiceDate: -1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ status: 1, invoiceDate: -1 });
invoiceSchema.index({ 'items.barcode': 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
