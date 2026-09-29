const Purchase = require('../models/Purchase');
const Payment = require('../models/Payment');
const ApiError = require('../utils/apiError');
const { computePurchasePayment, returnStatusFor } = require('../utils/accounting');

/**
 * Re-derives a purchase's payment / return position from Payment documents and returns.
 *
 *   paidAmount    = money paid to the vendor for this purchase
 *   dueAmount     = still payable AFTER returns
 *   refundDue     = paid more than the adjusted total (vendor owes us credit / refund)
 */
class PurchaseAccounting {
  static async recompute(purchaseOrId, session = null, { save = true } = {}) {
    const purchase =
      typeof purchaseOrId === 'object' && purchaseOrId._id
        ? purchaseOrId
        : await Purchase.findById(purchaseOrId).session(session);
    if (!purchase) throw ApiError.notFound('Purchase not found while recalculating payments');

    const payments = await Payment.find({
      referenceType: 'PURCHASE',
      referenceId: purchase._id,
      status: 'SUCCESS'
    }).session(session);

    let paid = 0;
    let refundReceived = 0;
    for (const p of payments) {
      if (p.direction === 'IN') refundReceived += p.amount;
      else paid += p.amount;
    }

    // A cancelled purchase owes nothing; money already paid is vendor credit (refundDue)
    const calc = computePurchasePayment({
      grandTotal: purchase.status === 'CANCELLED' ? 0 : purchase.grandTotal,
      returnedAmount: purchase.returnedAmount || 0,
      paid,
      refundReceived
    });

    purchase.paidAmount = calc.paid;
    purchase.dueAmount = calc.due;
    purchase.paymentStatus = calc.paymentStatus;
    purchase.adjustedTotal = calc.netPayable;
    purchase.refundReceived = calc.refundReceived;
    purchase.refundDue = calc.refundDue;
    purchase.returnStatus = returnStatusFor(purchase.items);

    if (save) await purchase.save({ session });
    return purchase;
  }
}

module.exports = PurchaseAccounting;
