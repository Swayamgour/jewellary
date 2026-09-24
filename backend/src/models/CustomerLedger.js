const mongoose = require('mongoose');

const customerLedgerSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    transactionDate: {
      type: Date,
      default: Date.now
    },
    entryType: {
      type: String,
      enum: ['SALE', 'PAYMENT', 'RETURN', 'EXCHANGE', 'OPENING', 'ADJUSTMENT'],
      required: true
    },
    referenceType: {
      type: String,
      enum: ['Invoice', 'Payment', 'SalesReturn', 'Exchange', 'Opening', 'Manual'],
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
      min: 0 // Invoices / Sales (Receivable increases)
    },
    credit: {
      type: Number,
      default: 0,
      min: 0 // Payments / Returns / Exchange (Receivable decreases)
    },
    runningBalance: {
      type: Number,
      required: true // Net outstanding after this entry
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

customerLedgerSchema.index({ customerId: 1, transactionDate: -1, createdAt: -1 });
customerLedgerSchema.index({ branchId: 1, transactionDate: -1 });
customerLedgerSchema.index({ referenceId: 1, referenceType: 1 });

module.exports = mongoose.model('CustomerLedger', customerLedgerSchema);
