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
    purchaseNo: { type: String, default: '' },
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
        purchaseItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
        inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
        barcode: { type: String, required: true },
        productName: { type: String, required: true },
        metal: { type: String, required: true },
        purity: { type: String, required: true },
        grossWeight: { type: Number, required: true },
        netWeight: { type: Number, required: true },
        quantity: { type: Number, default: 1, min: 1 },
        taxableAmount: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        amount: { type: Number, required: true },
        // Kept for compatibility with older clients: metal rate per gram of the purchase line
        rate: { type: Number, default: 0 }
      }
    ],
    totalTaxable: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String,
      required: true
    },
    // Snapshot of the purchase position right after this return
    reconciliation: {
      originalTotal: { type: Number, default: 0 },
      totalReturned: { type: Number, default: 0 },
      adjustedTotal: { type: Number, default: 0 },
      paid: { type: Number, default: 0 },
      adjustedDue: { type: Number, default: 0 },
      refundDue: { type: Number, default: 0 },
      vendorBalanceAfter: { type: Number, default: 0 }
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
purchaseReturnSchema.index({ branchId: 1, returnDate: -1 });

module.exports = mongoose.model('PurchaseReturn', purchaseReturnSchema);
