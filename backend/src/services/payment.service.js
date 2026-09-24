const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const LedgerService = require('./ledger.service');
const ApiError = require('../utils/apiError');
const DecimalUtil = require('../utils/decimal');
const BarcodeGenerator = require('../utils/barcodeGenerator');
const { PAYMENT_STATUSES, INVOICE_STATUSES } = require('../config/constants');

class PaymentService {
  /**
   * Record a payment (supports single or multi-mode array)
   */
  static async recordPayment({
    referenceType, // 'INVOICE', 'PURCHASE', 'ORDER', 'ADVANCE'
    referenceId,
    entityType, // 'CUSTOMER', 'VENDOR'
    entityId,
    amount,
    paymentMode,
    modeDetails = {},
    branchId,
    recordedBy,
    notes = '',
    session = null
  }) {
    if (amount <= 0) {
      throw ApiError.badRequest('Payment amount must be greater than zero');
    }

    let invoice = null;
    if (referenceType === 'INVOICE' && referenceId) {
      invoice = await Invoice.findById(referenceId).session(session);
      if (!invoice) {
        throw ApiError.notFound('Invoice not found for payment');
      }

      if (invoice.status === INVOICE_STATUSES.CANCELLED) {
        throw ApiError.badRequest('Cannot accept payments for a CANCELLED invoice');
      }

      const currentDue = invoice.paymentSummary.due || 0;
      if (amount > currentDue) {
        throw ApiError.badRequest(`Payment amount (${amount}) exceeds invoice remaining due (${currentDue})`);
      }
    }

    const paymentNo = BarcodeGenerator.generateInvoiceNo('PAY', 'RCPT', Math.floor(1000 + Math.random() * 9000));

    const payment = new Payment({
      paymentNo,
      referenceType,
      referenceId,
      entityType,
      entityId,
      amount: DecimalUtil.roundCurrency(amount),
      paymentDate: new Date(),
      paymentMode,
      modeDetails,
      branchId,
      recordedBy,
      status: PAYMENT_STATUSES.SUCCESS,
      notes
    });

    await payment.save({ session });

    // Update invoice payment summary if applicable
    if (invoice) {
      const newPaid = DecimalUtil.add(invoice.paymentSummary.paid, amount);
      const newDue = Math.max(0, DecimalUtil.subtract(invoice.grandTotal, newPaid));

      invoice.paymentSummary.paid = newPaid;
      invoice.paymentSummary.due = newDue;

      if (newDue === 0) {
        invoice.paymentStatus = 'PAID';
        if (invoice.status === INVOICE_STATUSES.CONFIRMED || invoice.status === INVOICE_STATUSES.PARTIAL) {
          invoice.status = INVOICE_STATUSES.PAID;
        }
      } else {
        invoice.paymentStatus = 'PARTIAL';
        invoice.status = INVOICE_STATUSES.PARTIAL;
      }

      await invoice.save({ session });
    }

    // Post to Customer or Vendor Ledger
    if (entityType === 'CUSTOMER') {
      await LedgerService.postCustomerEntry({
        customerId: entityId,
        entryType: 'PAYMENT',
        referenceType: 'Payment',
        referenceId: payment._id,
        description: `Payment received (${paymentMode}) - Ref: ${payment.paymentNo}`,
        credit: amount, // Payment reduces customer debt
        branchId,
        createdBy: recordedBy,
        session
      });
    } else if (entityType === 'VENDOR') {
      await LedgerService.postVendorEntry({
        vendorId: entityId,
        entryType: 'PAYMENT',
        referenceType: 'Payment',
        referenceId: payment._id,
        description: `Payment made to vendor (${paymentMode}) - Ref: ${payment.paymentNo}`,
        debit: amount, // Payment reduces vendor payable
        branchId,
        createdBy: recordedBy,
        session
      });
    }

    return payment;
  }

  /**
   * Reverse an existing payment
   */
  static async reversePayment({ paymentId, reversalReason, reversedBy, session = null }) {
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) {
      throw ApiError.notFound('Payment record not found');
    }

    if (payment.status === PAYMENT_STATUSES.REVERSED) {
      throw ApiError.badRequest('This payment has already been reversed');
    }

    payment.status = PAYMENT_STATUSES.REVERSED;
    payment.reversalReason = reversalReason;
    payment.reversedAt = new Date();
    payment.reversedBy = reversedBy;
    await payment.save({ session });

    // Reverse from Invoice if applicable
    if (payment.referenceType === 'INVOICE' && payment.referenceId) {
      const invoice = await Invoice.findById(payment.referenceId).session(session);
      if (invoice) {
        invoice.paymentSummary.paid = Math.max(0, DecimalUtil.subtract(invoice.paymentSummary.paid, payment.amount));
        invoice.paymentSummary.due = DecimalUtil.subtract(invoice.grandTotal, invoice.paymentSummary.paid);
        invoice.paymentStatus = invoice.paymentSummary.paid === 0 ? 'PENDING' : 'PARTIAL';
        invoice.status = invoice.paymentSummary.paid === 0 ? INVOICE_STATUSES.CONFIRMED : INVOICE_STATUSES.PARTIAL;
        await invoice.save({ session });
      }
    }

    // Reverse from Ledger
    if (payment.entityType === 'CUSTOMER') {
      await LedgerService.postCustomerEntry({
        customerId: payment.entityId,
        entryType: 'ADJUSTMENT',
        referenceType: 'Payment',
        referenceId: payment._id,
        description: `Reversal of Payment ${payment.paymentNo}: ${reversalReason}`,
        debit: payment.amount, // Reversal re-adds to customer debt
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
        description: `Reversal of Payment to Vendor ${payment.paymentNo}: ${reversalReason}`,
        credit: payment.amount, // Reversal re-adds to vendor payable
        branchId: payment.branchId,
        createdBy: reversedBy,
        session
      });
    }

    return payment;
  }
}

module.exports = PaymentService;
