const mongoose = require('mongoose');
const { METALS, PURITIES } = require('../config/constants');

const purchaseItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
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
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    makingAmount: {
      type: Number,
      default: 0
    },
    otherCharges: {
      type: Number,
      default: 0
    },
    taxableAmount: {
      type: Number,
      required: true,
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
    }
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
    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
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
    status: {
      type: String,
      enum: ['COMPLETED', 'CANCELLED'],
      default: 'COMPLETED'
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

purchaseSchema.index({ vendorId: 1, purchaseDate: -1 });
purchaseSchema.index({ branchId: 1, purchaseDate: -1 });
purchaseSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
