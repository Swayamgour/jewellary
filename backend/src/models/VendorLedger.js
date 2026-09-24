const mongoose = require('mongoose');

const vendorLedgerSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },
    transactionDate: {
      type: Date,
      default: Date.now
    },
    entryType: {
      type: String,
      enum: ['PURCHASE', 'PAYMENT', 'RETURN', 'OPENING', 'ADJUSTMENT'],
      required: true
    },
    referenceType: {
      type: String,
      enum: ['Purchase', 'Payment', 'PurchaseReturn', 'Opening', 'Manual'],
      required: true
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false
    },
    description: {
      type: String,
      required: true
    },
    debit: {
      type: Number,
      default: 0,
      min: 0 // Payments to vendor / Returns (Payable decreases)
    },
    credit: {
      type: Number,
      default: 0,
      min: 0 // Purchases from vendor (Payable increases)
    },
    runningBalance: {
      type: Number,
      required: true // Net payable after this entry
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

vendorLedgerSchema.index({ vendorId: 1, transactionDate: -1, createdAt: -1 });
vendorLedgerSchema.index({ branchId: 1, transactionDate: -1 });
vendorLedgerSchema.index({ referenceId: 1, referenceType: 1 });

module.exports = mongoose.model('VendorLedger', vendorLedgerSchema);
