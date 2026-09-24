const mongoose = require('mongoose');
const { ORDER_STATUSES, METALS, PURITIES } = require('../config/constants');

const orderItemSchema = new mongoose.Schema(
  {
    designName: {
      type: String,
      required: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
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
    estimatedGrossWeight: {
      type: Number,
      required: true
    },
    estimatedNetWeight: {
      type: Number,
      required: true
    },
    goldRateLocked: {
      type: Number,
      default: 0
    },
    estimatedMakingRate: {
      type: Number,
      default: 0
    },
    estimatedTotalAmount: {
      type: Number,
      required: true
    },
    specialInstructions: {
      type: String,
      default: ''
    },
    referenceImages: [
      {
        type: String
      }
    ]
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNo: {
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
    orderDate: {
      type: Date,
      default: Date.now
    },
    expectedDeliveryDate: {
      type: Date,
      required: true
    },
    actualDeliveryDate: {
      type: Date
    },
    items: [orderItemSchema],
    totalEstimatedAmount: {
      type: Number,
      required: true,
      min: 0
    },
    advancePaid: {
      type: Number,
      default: 0,
      min: 0
    },
    balanceDue: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUSES),
      default: ORDER_STATUSES.NEW
    },
    karigarDetails: {
      artisanName: { type: String, default: '' },
      phone: { type: String, default: '' },
      assignedDate: { type: Date },
      expectedCompletionDate: { type: Date }
    },
    deliveredInvoiceId: {
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

orderSchema.index({ customerId: 1, orderDate: -1 });
orderSchema.index({ branchId: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
