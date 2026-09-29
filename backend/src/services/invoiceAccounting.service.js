const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const ApiError = require('../utils/apiError');
const { computeInvoicePayment, returnStatusFor } = require('../utils/accounting');
const { INVOICE_STATUSES } = require('../config/constants');

/**
 * Single source of truth for an invoice's payment position.
 * The position is RE-DERIVED from the Payment collection (+ returns) every time, so the invoice can
 * never drift away from the payments / ledger no matter which flow touched it.
 */
class InvoiceAccounting {
  static async recompute(invoiceOrId, session = null, { save = true } = {}) {
    const invoice =
      typeof invoiceOrId === 'object' && invoiceOrId._id
        ? invoiceOrId
        : await Invoice.findById(invoiceOrId).session(session);
    if (!invoice) throw ApiError.notFound('Invoice not found while recalculating payments');

    const payments = await Payment.find({
      referenceType: 'INVOICE',
      referenceId: invoice._id,
      status: 'SUCCESS'
    }).session(session);

    let paidIn = 0;
    let refunded = 0;
    let exchangeAdjusted = 0;
    for (const p of payments) {
      if (p.direction === 'OUT') {
        refunded += p.amount;
      } else {
        paidIn += p.amount;
        if (p.paymentMode === 'EXCHANGE') exchangeAdjusted += p.amount;
      }
    }

    // A cancelled invoice owes nothing; anything received is customer credit (excessReceived)
    const calc = computeInvoicePayment({
      grandTotal: invoice.status === INVOICE_STATUSES.CANCELLED ? 0 : invoice.grandTotal,
      returnedAmount: invoice.returnedAmount || 0,
      paidIn,
      refunded,
      exchangeAdjusted
    });

    invoice.paymentSummary = {
      paid: calc.paid,
      due: calc.due,
      exchangeAdjusted: calc.exchangeAdjusted,
      refunded: calc.refunded,
      netPayable: calc.netPayable,
      excessReceived: calc.excessReceived
    };
    invoice.paymentStatus = calc.paymentStatus;
    invoice.returnStatus = returnStatusFor(invoice.items);

    // Payment progress lives in paymentStatus; normalise legacy documents
    if ([INVOICE_STATUSES.PARTIAL, INVOICE_STATUSES.PAID, INVOICE_STATUSES.DUE].includes(invoice.status)) {
      invoice.status = INVOICE_STATUSES.CONFIRMED;
    }

    if (save) await invoice.save({ session });
    return invoice;
  }
}

module.exports = InvoiceAccounting;
