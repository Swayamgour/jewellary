const mongoose = require('mongoose');
const { STOCK_MOVEMENT_TYPES } = require('../config/constants');

const stockMovementSchema = new mongoose.Schema(
  {
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true
    },
    barcode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    movementType: {
      type: String,
      enum: Object.values(STOCK_MOVEMENT_TYPES),
      required: true
    },
    quantityDelta: {
      type: Number,
      required: true // can be positive (+1 for purchase) or negative (-1 for sale)
    },
    weightDelta: {
      type: Number,
      required: true // net weight delta
    },
    balanceQuantity: {
      type: Number,
      required: true
    },
    balanceWeight: {
      type: Number,
      required: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true
    },
    targetBranchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch'
    },
    referenceType: {
      type: String,
      enum: ['Invoice', 'Purchase', 'SalesReturn', 'PurchaseReturn', 'Exchange', 'Manual', 'Transfer'],
      required: true
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

stockMovementSchema.index({ inventoryId: 1, createdAt: -1 });
stockMovementSchema.index({ barcode: 1 });
stockMovementSchema.index({ branchId: 1, movementType: 1, createdAt: -1 });
stockMovementSchema.index({ referenceId: 1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
