const mongoose = require('mongoose');

const purchaseReturnSchema = new mongoose.Schema(
  {
    returnNo: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      required: true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },
    returnDate: {
      type: Date,
      default: Date.now
    },
    items: [
      {
        barcode: { type: String, required: true },
        productName: { type: String, required: true },
        metal: { type: String, required: true },
        purity: { type: String, required: true },
        grossWeight: { type: Number, required: true },
        netWeight: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
        rate: { type: Number, required: true },
        amount: { type: Number, required: true }
      }
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String,
      required: true
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
    }
  },
  {
    timestamps: true
  }
);

purchaseReturnSchema.index({ purchaseId: 1 });
purchaseReturnSchema.index({ vendorId: 1, returnDate: -1 });
purchaseReturnSchema.index({ branchId: 1 });

module.exports = mongoose.model('PurchaseReturn', purchaseReturnSchema);
