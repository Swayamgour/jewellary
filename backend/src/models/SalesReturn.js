const mongoose = require('mongoose');

const salesReturnItemSchema = new mongoose.Schema(
  {
    invoiceItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    barcode: { type: String, required: true },
    productName: { type: String, required: true },
    metal: { type: String, required: true },
    purity: { type: String, required: true },
    grossWeight: { type: Number, required: true },
    stoneWeight: { type: Number, default: 0 },
    netWeight: { type: Number, required: true },
    quantity: { type: Number, default: 1, min: 1 },
    taxableAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    amount: { type: Number, required: true }, // taxable + GST for the returned units
    costAmount: { type: Number, default: 0 } // cost of the returned units (reverses COGS)
  },
  { _id: true }
);

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
    invoiceNo: {
      type: String,
      default: ''
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
    items: [salesReturnItemSchema],
    totalTaxable: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    // Value of the goods handed back (this is the credit-note value)
    totalRefundAmount: {
      type: Number,
      required: true,
      min: 0
    },
    roundOff: { type: Number, default: 0 },
    refundType: {
      type: String,
      enum: ['LEDGER_CREDIT', 'CASH', 'UPI', 'BANK_TRANSFER'],
      default: 'LEDGER_CREDIT'
    },
    // How the credit-note value was settled
    settlement: {
      adjustedAgainstDue: { type: Number, default: 0 }, // reduced what the customer still owed
      cashRefunded: { type: Number, default: 0 }, // paid back through refundType
      creditRetained: { type: Number, default: 0 } // left as customer credit on the ledger
    },
    refundPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
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
salesReturnSchema.index({ branchId: 1, returnDate: -1 });

module.exports = mongoose.model('SalesReturn', salesReturnSchema);
