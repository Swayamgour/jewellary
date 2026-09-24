const mongoose = require('mongoose');
const { METALS, PURITIES, MAKING_CHARGE_TYPES } = require('../config/constants');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    code: {
      type: String,
      required: [true, 'Product code is required'],
      uppercase: true,
      trim: true
    },
    sku: {
      type: String,
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
    hsnCode: {
      type: String,
      default: '7113'
    },
    description: {
      type: String,
      default: ''
    },
    standardGrossWeight: {
      type: Number,
      default: 0
    },
    standardStoneWeight: {
      type: Number,
      default: 0
    },
    standardNetWeight: {
      type: Number,
      default: 0
    },
    makingType: {
      type: String,
      enum: Object.values(MAKING_CHARGE_TYPES),
      default: MAKING_CHARGE_TYPES.PER_GRAM
    },
    makingRate: {
      type: Number,
      default: 0
    },
    wastagePercent: {
      type: Number,
      default: 0
    },
    images: [
      {
        type: String
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

productSchema.index({ code: 1 });
productSchema.index({ categoryId: 1, metal: 1, purity: 1 });
productSchema.index({ name: 'text', code: 'text' });
productSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Product', productSchema);
