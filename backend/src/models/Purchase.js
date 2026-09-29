const mongoose = require('mongoose');
const { METALS, PURITIES, PURCHASE_STATUSES } = require('../config/constants');

const purchaseItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    purchaseOrderItemId: {
      type: mongoose.Schema.Types.ObjectId
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory'
    },
    productName: {
      type: String,
      required: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    barcode: {
      type: String,
      trim: true,
      uppercase: true
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
    // Weights are PER UNIT (per piece)
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
    // Metal rate per gram
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    // Line totals (for the whole quantity on the line)
    makingAmount: {
      type: Number,
      default: 0
    },
    otherCharges: {
      type: Number,
      default: 0
    },
    // netWeight * quantity * rate + makingAmount + otherCharges
    taxableAmount: {
      type: Number,
      required: true,
      min: 0
    },
    gstRate: {
      type: Number,
      default: 0,
      min: 0
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    // Landed cost of ONE unit that was posted to inventory
    unitCost: {
      type: Number,
      default: 0
    },
    // Purchase-return tracking
    returnedQty: { type: Number, default: 0, min: 0 },
    returnedTaxable: { type: Number, default: 0, min: 0 },
    returnedTax: { type: Number, default: 0, min: 0 }
  },
  { _id: true }
);

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNo: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    vendorInvoiceNo: {
      type: String,
      default: '',
      trim: true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder'
    },
    purchaseDate: {
      type: Date,
      default: Date.now
    },
    items: [purchaseItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0
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
    // ---- payment position (derived by PurchaseAccounting.recompute) ----
    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    // Still payable AFTER returns
    dueAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'PAID'],
      default: 'PENDING'
    },
    // ---- return reconciliation ----
    returnedAmount: { type: Number, default: 0, min: 0 },
    adjustedTotal: { type: Number, default: 0, min: 0 }, // grandTotal - returnedAmount
    refundReceived: { type: Number, default: 0, min: 0 }, // money the vendor gave back
    refundDue: { type: Number, default: 0, min: 0 }, // vendor owes us (paid > adjustedTotal)
    returnStatus: {
      type: String,
      enum: ['NONE', 'PARTIAL', 'FULL'],
      default: 'NONE'
    },
    status: {
      type: String,
      enum: Object.values(PURCHASE_STATUSES),
      default: PURCHASE_STATUSES.COMPLETED
    },
    postedAt: { type: Date },
    cancellation: {
      reason: { type: String, default: '' },
      cancelledAt: { type: Date },
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      paymentAction: { type: String, enum: ['REFUND', 'CREDIT', 'NONE'] }
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
    timestamps: true,
    optimisticConcurrency: true
  }
);

purchaseSchema.index({ vendorId: 1, purchaseDate: -1 });
purchaseSchema.index({ branchId: 1, purchaseDate: -1 });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ status: 1, purchaseDate: -1 });
purchaseSchema.index({ purchaseOrderId: 1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
