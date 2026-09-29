const mongoose = require('mongoose');
const { METALS, PURITIES, INVENTORY_STATUSES, MAKING_CHARGE_TYPES } = require('../config/constants');

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    barcode: {
      type: String,
      required: [true, 'Barcode is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    metal: {
      type: String,
      enum: Object.values(METALS),
      required: true,
      default: METALS.GOLD
    },
    purity: {
      type: String,
      enum: Object.values(PURITIES),
      required: true,
      default: PURITIES.GOLD_22K
    },
    // NOTE: grossWeight / stoneWeight / netWeight are PER UNIT (per piece).
    // Real stock weight = per-unit weight x quantity  (see totalNetWeight / totalGrossWeight virtuals).
    grossWeight: {
      type: Number,
      required: [true, 'Gross weight is required'],
      min: [0, 'Gross weight cannot be negative']
    },
    stoneWeight: {
      type: Number,
      default: 0,
      min: [0, 'Stone weight cannot be negative']
    },
    netWeight: {
      type: Number,
      required: [true, 'Net weight is required'],
      min: [0, 'Net weight cannot be negative']
    },
    quantity: {
      type: Number,
      default: 1,
      min: [0, 'Stock quantity cannot be negative']
    },
    // Landed cost of ONE unit (metal + making + other charges, excluding recoverable GST)
    costPrice: {
      type: Number,
      default: 0,
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
    wastagePercent: {
      type: Number,
      default: 0,
      min: 0
    },
    stoneAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true
    },
    warehouseLocation: {
      type: String,
      default: 'Main Counter'
    },
    status: {
      type: String,
      enum: Object.values(INVENTORY_STATUSES),
      default: INVENTORY_STATUSES.AVAILABLE
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase'
    },
    lastSoldInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

inventorySchema.virtual('totalNetWeight').get(function () {
  return Math.round((this.netWeight || 0) * (this.quantity || 0) * 1000) / 1000;
});
inventorySchema.virtual('totalGrossWeight').get(function () {
  return Math.round((this.grossWeight || 0) * (this.quantity || 0) * 1000) / 1000;
});
inventorySchema.virtual('totalCost').get(function () {
  return Math.round((this.costPrice || 0) * (this.quantity || 0) * 100) / 100;
});

inventorySchema.index({ branchId: 1, status: 1 });
inventorySchema.index({ branchId: 1, productId: 1, status: 1, quantity: 1 });
inventorySchema.index({ productId: 1, branchId: 1 });
inventorySchema.index({ metal: 1, purity: 1 });
inventorySchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
