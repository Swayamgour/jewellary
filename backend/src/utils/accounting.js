/**
 * Pure accounting helpers (no database access) so the money rules are easy to unit-test.
 *
 * Sign conventions
 *   Customer ledger : debit  = customer owes us more   | credit = customer owes us less
 *   Vendor ledger   : credit = we owe vendor more      | debit  = we owe vendor less
 */
const DecimalUtil = require('./decimal');

const r2 = (n) => DecimalUtil.roundCurrency(n);

/**
 * Sales invoice payment position.
 *
 *   netPayable  = grandTotal - returnedAmount
 *   netReceived = paidIn - refunded              (paidIn already contains old-gold exchange adjustments)
 *   due         = max(0, netPayable - netReceived)
 *   excess      = max(0, netReceived - netPayable)  -> money we hold that belongs to the customer
 */
function computeInvoicePayment({ grandTotal = 0, returnedAmount = 0, paidIn = 0, refunded = 0, exchangeAdjusted = 0 }) {
  const netPayable = Math.max(0, r2(grandTotal - returnedAmount));
  const netReceived = r2(paidIn - refunded);
  const due = Math.max(0, r2(netPayable - netReceived));
  const excessReceived = Math.max(0, r2(netReceived - netPayable));

  let paymentStatus = 'PENDING';
  if (due === 0) paymentStatus = 'PAID';
  else if (netReceived > 0) paymentStatus = 'PARTIAL';

  return {
    netPayable,
    paid: r2(paidIn),
    refunded: r2(refunded),
    exchangeAdjusted: r2(exchangeAdjusted),
    netReceived,
    due,
    excessReceived,
    paymentStatus
  };
}

/**
 * Purchase payment position after returns.
 *
 *   netPayable   = grandTotal - returnedAmount
 *   netPaid      = paid - refundReceived
 *   due          = max(0, netPayable - netPaid)
 *   refundDue    = max(0, netPaid - netPayable)   -> vendor owes us (credit / refund)
 */
function computePurchasePayment({ grandTotal = 0, returnedAmount = 0, paid = 0, refundReceived = 0 }) {
  const netPayable = Math.max(0, r2(grandTotal - returnedAmount));
  const netPaid = r2(paid - refundReceived);
  const due = Math.max(0, r2(netPayable - netPaid));
  const refundDue = Math.max(0, r2(netPaid - netPayable));

  let paymentStatus = 'PENDING';
  if (due === 0) paymentStatus = 'PAID';
  else if (netPaid > 0) paymentStatus = 'PARTIAL';

  return { netPayable, paid: r2(paid), refundReceived: r2(refundReceived), netPaid, due, refundDue, paymentStatus };
}

function returnStatusFor(items) {
  const totalQty = items.reduce((a, i) => a + (i.quantity || 0), 0);
  const returnedQty = items.reduce((a, i) => a + (i.returnedQty || 0), 0);
  if (returnedQty <= 0) return 'NONE';
  return returnedQty >= totalQty ? 'FULL' : 'PARTIAL';
}

/**
 * Value of returning `returnQty` units of an invoice line.
 * Uses the line's discount-adjusted taxable value and its share of GST, so the customer gets back
 * exactly what they paid for those units. The last remaining units take the rounding remainder.
 */
function computeInvoiceReturnLine(invoice, item, returnQty) {
  const qty = item.quantity || 1;
  const alreadyReturned = item.returnedQty || 0;
  const remaining = qty - alreadyReturned;

  if (returnQty <= 0) throw new Error('Return quantity must be greater than zero');
  if (returnQty > remaining) {
    throw new Error(`Return quantity ${returnQty} exceeds remaining returnable quantity ${remaining}`);
  }

  // Legacy invoices (created before per-line tax allocation) fall back to proportional maths.
  const invoiceTaxable = invoice.taxableAmount || 0;
  const lineEffective =
    item.effectiveTaxableAmount !== undefined && item.effectiveTaxableAmount !== null && item.effectiveTaxableAmount > 0
      ? item.effectiveTaxableAmount
      : invoiceTaxable > 0
      ? r2((item.taxableAmount || 0) - ((invoice.discount || 0) - itemsDiscount(invoice)) * safeDiv(item.taxableAmount, sumTaxable(invoice)))
      : item.taxableAmount || 0;
  const lineTax =
    item.taxAmount !== undefined && item.taxAmount !== null && item.taxAmount > 0
      ? item.taxAmount
      : invoiceTaxable > 0
      ? r2(((invoice.tax && invoice.tax.totalTax) || 0) * safeDiv(lineEffective, invoiceTaxable))
      : 0;

  const isLast = returnQty === remaining;
  const taxable = isLast
    ? r2(lineEffective - (item.returnedTaxable || 0))
    : r2((lineEffective * returnQty) / qty);
  const tax = isLast ? r2(lineTax - (item.returnedTax || 0)) : r2((lineTax * returnQty) / qty);

  return { taxable: Math.max(0, taxable), tax: Math.max(0, tax), amount: Math.max(0, r2(taxable + tax)) };
}

function safeDiv(a, b) {
  return b ? a / b : 0;
}
function sumTaxable(invoice) {
  return (invoice.items || []).reduce((a, i) => a + (i.taxableAmount || 0), 0);
}
function itemsDiscount(invoice) {
  return (invoice.items || []).reduce((a, i) => a + (i.discount || 0), 0);
}

/**
 * Value of returning units of a purchase line (tax inclusive, because the vendor bill was tax inclusive).
 */
function computePurchaseReturnLine(item, returnQty) {
  const qty = item.quantity || 1;
  const alreadyReturned = item.returnedQty || 0;
  const remaining = qty - alreadyReturned;

  if (returnQty <= 0) throw new Error('Return quantity must be greater than zero');
  if (returnQty > remaining) {
    throw new Error(`Return quantity ${returnQty} exceeds remaining returnable quantity ${remaining}`);
  }

  const isLast = returnQty === remaining;
  const taxable = isLast
    ? r2(item.taxableAmount - (item.returnedTaxable || 0))
    : r2((item.taxableAmount * returnQty) / qty);
  const tax = isLast ? r2((item.taxAmount || 0) - (item.returnedTax || 0)) : r2(((item.taxAmount || 0) * returnQty) / qty);
  return { taxable: Math.max(0, taxable), tax: Math.max(0, tax), amount: Math.max(0, r2(taxable + tax)) };
}

/**
 * Split an invoice-level discount across lines pro-rata to their taxable value.
 * The final line absorbs rounding so the parts always add up to the invoice taxable amount.
 */
function allocateByShare(total, weights) {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (!sum || !total) return weights.map(() => 0);
  let allocated = 0;
  return weights.map((w, idx) => {
    if (idx === weights.length - 1) return r2(total - allocated);
    const part = r2((total * w) / sum);
    allocated = r2(allocated + part);
    return part;
  });
}

module.exports = {
  computeInvoicePayment,
  computePurchasePayment,
  computeInvoiceReturnLine,
  computePurchaseReturnLine,
  returnStatusFor,
  allocateByShare
};
