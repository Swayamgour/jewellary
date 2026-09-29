const mongoose = require('mongoose');
const { METALS, PURITIES, PURCHASE_ORDER_STATUSES } = require('../config/constants');

const poItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    productName: { type: String, required: true },
    metal: { type: String, enum: Object.values(METALS), default: METALS.GOLD },
    purity: { type: String, enum: Object.values(PURITIES), default: PURITIES.GOLD_22K },
    // Expected weights are PER UNIT
    grossWeight: { type: Number, required: true, min: 0 },
    stoneWeight: { type: Number, default: 0, min: 0 },
    netWeight: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 }, // ordered
    receivedQty: { type: Number, default: 0, min: 0 },
    rate: { type: Number, required: true, min: 0 }, // per gram
    makingAmount: { type: Number, default: 0 }, // for the full ordered quantity
    otherCharges: { type: Number, default: 0 }, // for the full ordered quantity
    gstRate: { type: Number, default: 0, min: 0 },
    estimatedAmount: { type: Number, default: 0 } // taxable estimate for the ordered quantity
  },
  { _id: true }
);

const poSchema = new mongoose.Schema(
  {
    poNo: { type: String, required: true, unique: true, trim: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    poDate: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date },
    items: [poItemSchema],
    estimatedSubtotal: { type: Number, default: 0 },
    estimatedTax: { type: Number, default: 0 },
    estimatedTotal: { type: Number, default: 0 },

    // DRAFT -> SUBMITTED -> APPROVED -> ORDERED -> PARTIALLY_RECEIVED -> RECEIVED -> CLOSED
    // (SUBMITTED -> REJECTED -> DRAFT to rework;  DRAFT/SUBMITTED/APPROVED/ORDERED -> CANCELLED before any receipt)
    status: {
      type: String,
      enum: Object.values(PURCHASE_ORDER_STATUSES),
      default: PURCHASE_ORDER_STATUSES.DRAFT
    },
    statusHistory: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, default: '' }
      }
    ],

    submittedAt: Date,
    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, default: '' },
    orderedAt: Date,
    closedAt: Date,
    closeReason: { type: String, default: '' },
    cancellationReason: { type: String, default: '' },

    receipts: [
      {
        purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
        purchaseNo: String,
        receivedAt: { type: Date, default: Date.now },
        receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }
    ],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, default: '' }
  },
  { timestamps: true, optimisticConcurrency: true }
);

poSchema.index({ vendorId: 1, poDate: -1 });
poSchema.index({ branchId: 1, status: 1 });
poSchema.index({ status: 1, expectedDeliveryDate: 1 });

module.exports = mongoose.model('PurchaseOrder', poSchema);
