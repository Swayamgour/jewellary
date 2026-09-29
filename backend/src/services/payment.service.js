const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const Order = require('../models/Order');
const Branch = require('../models/Branch');
const LedgerService = require('./ledger.service');
const InvoiceAccounting = require('./invoiceAccounting.service');
const PurchaseAccounting = require('./purchaseAccounting.service');
const ApiError = require('../utils/apiError');
const DecimalUtil = require('../utils/decimal');
const { nextDocNo } = require('../utils/sequence');
const { PAYMENT_STATUSES, INVOICE_STATUSES, PURCHASE_STATUSES, ORDER_STATUSES } = require('../config/constants');

class PaymentService {
  static async nextPaymentNo(branchId, session) {
    const branch = await Branch.findById(branchId).select('code').session(session);
    return nextDocNo('PAY', branch?.code || 'BR', session, { model: Payment, field: 'paymentNo' });
  }

  /**
   * Recalculate whatever document a payment belongs to.
   */
  static async refreshReference({ referenceType, referenceId, invoiceDoc, purchaseDoc, session }) {
    if (!referenceId) return null;
    if (referenceType === 'INVOICE') {
      return InvoiceAccounting.recompute(invoiceDoc || referenceId, session);
    }
    if (referenceType === 'PURCHASE') {
      return PurchaseAccounting.recompute(purchaseDoc || referenceId, session);
    }
    if (referenceType === 'ORDER') {
      const order = await Order.findById(referenceId).session(session);
      if (!order) return null;
      const payments = await Payment.find({ referenceType: 'ORDER', referenceId, status: PAYMENT_STATUSES.SUCCESS }).session(session);
      const net = payments.reduce((a, p) => DecimalUtil.add(a, p.direction === 'OUT' ? -p.amount : p.amount), 0);
      order.advancePaid = Math.max(0, DecimalUtil.roundCurrency(net));
      order.balanceDue = Math.max(0, DecimalUtil.subtract(order.totalEstimatedAmount, order.advancePaid));
      await order.save({ session });
      return order;
    }
    return null;
  }

  /**
   * Record a payment (customer receipt, vendor payment, or - internally - a refund).
   *
   * direction defaults to IN for customers and OUT for vendors. Refund flows (sales return, cancellation,
   * vendor refund) pass `direction` explicitly together with `internal: true`, which skips the
   * "amount must not exceed due" rule because those flows validate their own limits.
   */
  static async recordPayment({
    referenceType, // 'INVOICE', 'PURCHASE', 'ORDER', 'EXCHANGE', 'ADVANCE', 'DIRECT'
    referenceId,
    entityType, // 'CUSTOMER', 'VENDOR'
    entityId,
    amount,
    paymentMode,
    modeDetails = {},
    branchId,
    recordedBy,
    notes = '',
    direction = null,
    linkedDocType = null,
    linkedDocId = null,
    internal = false,
    postLedger = true,
    invoiceDoc = null,
    purchaseDoc = null,
    session = null
  }) {
    amount = DecimalUtil.roundCurrency(amount);
    if (!(amount > 0)) {
      throw ApiError.badRequest('Payment amount must be greater than zero');
    }
    if (paymentMode === 'EXCHANGE' && !internal) {
      throw ApiError.badRequest('Old-gold adjustments are recorded through the Exchange module, not as a normal payment');
    }

    direction = direction || (entityType === 'CUSTOMER' ? 'IN' : 'OUT');

    let invoice = null;
    let purchase = null;

    if (referenceType === 'INVOICE' && referenceId) {
      invoice = invoiceDoc || (await Invoice.findById(referenceId).session(session));
      if (!invoice) throw ApiError.notFound('Invoice not found for payment');
      if (entityType !== 'CUSTOMER' || invoice.customerId.toString() !== entityId.toString()) {
        throw ApiError.badRequest('Payment customer does not match the invoice customer');
      }
      if (!internal) {
        if (invoice.status === INVOICE_STATUSES.DRAFT) {
          throw ApiError.badRequest('This invoice is still a DRAFT. Confirm it before taking payment.');
        }
        if (invoice.status === INVOICE_STATUSES.CANCELLED) {
          throw ApiError.badRequest('Cannot accept payments for a CANCELLED invoice');
        }
        if (invoice.status === INVOICE_STATUSES.CONVERTED) {
          throw ApiError.badRequest('This Kacha bill was converted to a Pakka invoice - take the payment on the Pakka invoice');
        }
        if (direction !== 'IN') {
          throw ApiError.badRequest('Refunds are recorded through sales return / cancellation');
        }
        const currentDue = invoice.paymentSummary?.due || 0;
        if (amount > currentDue) {
          throw ApiError.badRequest(`Payment amount (${amount}) exceeds invoice remaining due (${currentDue})`);
        }
      }
    } else if (referenceType === 'PURCHASE' && referenceId) {
      purchase = purchaseDoc || (await Purchase.findById(referenceId).session(session));
      if (!purchase) throw ApiError.notFound('Purchase not found for payment');
      if (entityType !== 'VENDOR' || purchase.vendorId.toString() !== entityId.toString()) {
        throw ApiError.badRequest('Payment vendor does not match the purchase vendor');
      }
      if (!internal) {
        if (purchase.status !== PURCHASE_STATUSES.COMPLETED) {
          throw ApiError.badRequest(`Cannot pay a purchase in ${purchase.status} state`);
        }
        if (direction !== 'OUT') {
          throw ApiError.badRequest('Vendor refunds are recorded through the purchase refund endpoint');
        }
        if (amount > (purchase.dueAmount || 0)) {
          throw ApiError.badRequest(`Payment amount (${amount}) exceeds purchase remaining due (${purchase.dueAmount || 0})`);
        }
      }
    } else if (referenceType === 'ORDER' && referenceId) {
      const order = await Order.findById(referenceId).session(session);
      if (!order) throw ApiError.notFound('Order not found for payment');
      if (entityType !== 'CUSTOMER' || order.customerId.toString() !== entityId.toString()) {
        throw ApiError.badRequest('Payment customer does not match the order customer');
      }
      if (!internal) {
        if ([ORDER_STATUSES.CANCELLED, ORDER_STATUSES.DELIVERED].includes(order.status)) {
          throw ApiError.badRequest(`Cannot take payment on a ${order.status} order`);
        }
        if (amount > (order.balanceDue || 0)) {
          throw ApiError.badRequest(`Payment amount (${amount}) exceeds order balance (${order.balanceDue || 0})`);
        }
      }
    }

    const paymentNo = await this.nextPaymentNo(branchId, session);

    const payment = new Payment({
      paymentNo,
      referenceType,
      referenceId: referenceId || undefined,
      entityType,
      entityId,
      direction,
      linkedDocType,
      linkedDocId,
      amount,
      paymentDate: new Date(),
      paymentMode,
      modeDetails,
      branchId,
      recordedBy,
      status: PAYMENT_STATUSES.SUCCESS,
      notes
    });
    await payment.save({ session });

    // Ledger
    if (postLedger) {
      if (entityType === 'CUSTOMER') {
        await LedgerService.postCustomerEntry({
          customerId: entityId,
          entryType: direction === 'IN' ? 'PAYMENT' : 'REFUND',
          referenceType: 'Payment',
          referenceId: payment._id,
          description:
            direction === 'IN'
              ? `Payment received (${paymentMode}) - Ref: ${payment.paymentNo}`
              : `Refund paid to customer (${paymentMode}) - Ref: ${payment.paymentNo}`,
          credit: direction === 'IN' ? amount : 0,
          debit: direction === 'OUT' ? amount : 0,
          branchId,
          createdBy: recordedBy,
          session
        });
      } else if (entityType === 'VENDOR') {
        await LedgerService.postVendorEntry({
          vendorId: entityId,
          entryType: direction === 'OUT' ? 'PAYMENT' : 'REFUND',
          referenceType: 'Payment',
          referenceId: payment._id,
          description:
            direction === 'OUT'
              ? `Payment made to vendor (${paymentMode}) - Ref: ${payment.paymentNo}`
              : `Refund received from vendor (${paymentMode}) - Ref: ${payment.paymentNo}`,
          debit: direction === 'OUT' ? amount : 0,
          credit: direction === 'IN' ? amount : 0,
          branchId,
          createdBy: recordedBy,
          session
        });
      }
    }

    // Keep the referenced document in step with its payments
    await this.refreshReference({ referenceType, referenceId, invoiceDoc: invoice, purchaseDoc: purchase, session });

    return payment;
  }

  /**
   * Reverse (void) a payment: status -> REVERSED, ledger gets the opposite entry, the referenced
   * invoice / purchase / order is recalculated.
   */
  static async reversePayment({ paymentId, reversalReason, reversedBy, session = null }) {
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) throw ApiError.notFound('Payment record not found');

    if (payment.status === PAYMENT_STATUSES.REVERSED) {
      throw ApiError.badRequest('This payment has already been reversed');
    }
    if (payment.paymentMode === 'EXCHANGE') {
      throw ApiError.badRequest('Old-gold adjustments cannot be reversed here. Cancel the invoice or the exchange instead.');
    }

    payment.status = PAYMENT_STATUSES.REVERSED;
    payment.reversalReason = reversalReason;
    payment.reversedAt = new Date();
    payment.reversedBy = reversedBy;
    await payment.save({ session });

    if (payment.entityType === 'CUSTOMER') {
      await LedgerService.postCustomerEntry({
        customerId: payment.entityId,
        entryType: 'ADJUSTMENT',
        referenceType: 'Payment',
        referenceId: payment._id,
        description: `Reversal of Payment ${payment.paymentNo}: ${reversalReason}`,
        // reversing a receipt puts the debt back, reversing a refund removes it again
        debit: payment.direction === 'IN' ? payment.amount : 0,
        credit: payment.direction === 'OUT' ? payment.amount : 0,
        branchId: payment.branchId,
        createdBy: reversedBy,
        session
      });
    } else if (payment.entityType === 'VENDOR') {
      await LedgerService.postVendorEntry({
        vendorId: payment.entityId,
        entryType: 'ADJUSTMENT',
        referenceType: 'Payment',
        referenceId: payment._id,
        description: `Reversal of Payment ${payment.paymentNo}: ${reversalReason}`,
        credit: payment.direction === 'OUT' ? payment.amount : 0,
        debit: payment.direction === 'IN' ? payment.amount : 0,
        branchId: payment.branchId,
        createdBy: reversedBy,
        session
      });
    }

    await this.refreshReference({
      referenceType: payment.referenceType,
      referenceId: payment.referenceId,
      session
    });

    return payment;
  }
}

module.exports = PaymentService;
