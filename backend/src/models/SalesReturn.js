const mongoose = require('mongoose');

const salesReturnSchema = new mongoose.Schema(
  {
    returnNo: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
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
        stoneWeight: { type: Number, default: 0 },
        netWeight: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
        rate: { type: Number, required: true },
        amount: { type: Number, required: true }
      }
    ],
    totalRefundAmount: {
      type: Number,
      required: true,
      min: 0
    },
    refundType: {
      type: String,
      enum: ['LEDGER_CREDIT', 'CASH', 'UPI', 'BANK_TRANSFER'],
      default: 'LEDGER_CREDIT'
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

salesReturnSchema.index({ invoiceId: 1 });
salesReturnSchema.index({ customerId: 1, returnDate: -1 });
salesReturnSchema.index({ branchId: 1 });

module.exports = mongoose.model('SalesReturn', salesReturnSchema);
