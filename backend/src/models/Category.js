const mongoose = require('mongoose');
const { METALS, MAKING_CHARGE_TYPES } = require('../config/constants');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true
    },
    code: {
      type: String,
      required: [true, 'Category code is required'],
      uppercase: true,
      trim: true
    },
    metal: {
      type: String,
      enum: Object.values(METALS),
      default: METALS.GOLD
    },
    hsnCode: {
      type: String,
      default: '7113' // Default Indian GST HSN Code for articles of jewellery
    },
    defaultMakingType: {
      type: String,
      enum: Object.values(MAKING_CHARGE_TYPES),
      default: MAKING_CHARGE_TYPES.PER_GRAM
    },
    defaultMakingRate: {
      type: Number,
      default: 0
    },
    defaultWastagePercent: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      default: ''
    },
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

categorySchema.index({ metal: 1 });
categorySchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Category', categorySchema);
