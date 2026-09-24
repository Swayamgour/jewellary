const mongoose = require('mongoose');
const { METALS, PURITIES } = require('../config/constants');

const goldRateSchema = new mongoose.Schema(
  {
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
    rate: {
      type: Number,
      required: [true, 'Rate per gram is required'],
      min: [0, 'Rate cannot be negative']
    },
    effectiveDate: {
      type: Date,
      default: Date.now
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true
    },
    isCurrent: {
      type: Boolean,
      default: true
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

goldRateSchema.index({ branchId: 1, metal: 1, purity: 1, isCurrent: 1 });
goldRateSchema.index({ effectiveDate: -1 });

module.exports = mongoose.model('GoldRate', goldRateSchema);
