const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const Payment = require('../models/Payment');
const CalculationService = require('./calculation.service');
const InventoryService = require('./inventory.service');
const LedgerService = require('./ledger.service');
const PaymentService = require('./payment.service');
const { withTransaction } = require('../utils/transaction');
const { logAudit } = require('../utils/auditLogger');
const BarcodeGenerator = require('../utils/barcodeGenerator');
const ApiError = require('../utils/apiError');
const DecimalUtil = require('../utils/decimal');
const { BILL_TYPES, INVOICE_STATUSES, AUDIT_ACTIONS } = require('../config/constants');

class BillingService {
  /**
   * Helper to count existing invoices to generate sequential invoice number
   */
  static async getNextInvoiceNo(prefix, branchCode) {
    const count = await Invoice.countDocuments({
      invoiceNo: new RegExp(`^${prefix}/${branchCode}/`)
    });
    return BarcodeGenerator.generateInvoiceNo(prefix, branchCode, count + 1);
  }

  /**
   * Create Kacha Bill
   */
  static async createKachaBill({
    customerId,
    branchId,
    items,
    discount = 0,
    payments = [],
    notes = '',
    userId,
    status = INVOICE_STATUSES.CONFIRMED
  }) {
    return await withTransaction(async (session) => {
      const customer = await Customer.findById(customerId).session(session);
      if (!customer) {
        throw ApiError.notFound('Customer not found');
      }

      const branch = await Branch.findById(branchId).session(session);
      if (!branch) {
        throw ApiError.notFound('Branch not found');
      }

      // Calculate totals
      const calculation = CalculationService.calculateInvoiceTotals({
        items,
        billType: BILL_TYPES.KACHA,
        branchStateCode: branch.address?.stateCode || '07',
        customerStateCode: customer.address?.stateCode || '07',
        extraDiscount: discount
      });

      const invoiceNo = await this.getNextInvoiceNo('KACHA', branch.code || 'BR');

      const customerSnapshot = {
        name: customer.name,
        mobile: customer.mobile,
        address: `${customer.address?.street || ''} ${customer.address?.city || ''}`.trim(),
        gstin: customer.gstin || '',
        state: customer.address?.state || '',
        stateCode: customer.address?.stateCode || '07'
      };

      const invoice = new Invoice({
        invoiceNo,
        billType: BILL_TYPES.KACHA,
        invoiceDate: new Date(),
        customerId: customer._id,
        customerSnapshot,
        branchId,
        createdBy: userId,
        items: calculation.items,
        subtotal: calculation.subtotal,
        discount: calculation.discount,
        taxableAmount: calculation.taxableAmount,
        tax: calculation.tax,
        roundOff: calculation.roundOff,
        grandTotal: calculation.grandTotal,
        paymentSummary: {
          paid: 0,
          due: calculation.grandTotal,
          exchangeAdjusted: 0
        },
        status,
        paymentStatus: 'PENDING',
        notes
      });

      await invoice.save({ session });

      // Deduct inventory stock if bill is CONFIRMED
      if (status === INVOICE_STATUSES.CONFIRMED) {
        for (const item of calculation.items) {
          if (item.barcode || item.productId) {
            await InventoryService.deductItemForSale({
              barcode: item.barcode,
              productId: item.productId,
              branchId,
              quantity: item.quantity || 1,
              invoiceId: invoice._id,
              performedBy: userId,
              session
            });
          }
        }

        // Post Debit to Customer Ledger (Increases receivable)
        await LedgerService.postCustomerEntry({
          customerId: customer._id,
          entryType: 'SALE',
          referenceType: 'Invoice',
          referenceId: invoice._id,
          description: `Kacha Bill #${invoice.invoiceNo}`,
          debit: invoice.grandTotal,
          branchId,
          createdBy: userId,
          session
        });
      }

      // Process initial checkout payments if provided
      if (payments && payments.length > 0) {
        for (const p of payments) {
          if (p.amount > 0) {
            await PaymentService.recordPayment({
              referenceType: 'INVOICE',
              referenceId: invoice._id,
              entityType: 'CUSTOMER',
              entityId: customer._id,
              amount: p.amount,
              paymentMode: p.paymentMode,
              modeDetails: p.modeDetails || {},
              branchId,
              recordedBy: userId,
              notes: `Checkout payment for ${invoice.invoiceNo}`,
              session
            });
          }
        }
      }

      // Refetch updated invoice with payments
      const finalInvoice = await Invoice.findById(invoice._id).session(session);

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.CREATE,
          module: 'INVOICE',
          recordId: invoice._id,
          newValue: finalInvoice.toObject(),
          branchId
        },
        session
      );

      return finalInvoice;
    });
  }

  /**
   * Create Pakka Bill (GST Invoice)
   */
  static async createPakkaBill({
    customerId,
    branchId,
    items,
    discount = 0,
    payments = [],
    notes = '',
    userId,
    status = INVOICE_STATUSES.CONFIRMED
  }) {
    return await withTransaction(async (session) => {
      const customer = await Customer.findById(customerId).session(session);
      if (!customer) {
        throw ApiError.notFound('Customer not found');
      }

      const branch = await Branch.findById(branchId).session(session);
      if (!branch) {
        throw ApiError.notFound('Branch not found');
      }

      // Calculate totals with GST
      const calculation = CalculationService.calculateInvoiceTotals({
        items,
        billType: BILL_TYPES.PAKKA,
        branchStateCode: branch.address?.stateCode || '07',
        customerStateCode: customer.address?.stateCode || '07',
        extraDiscount: discount
      });

      const invoiceNo = await this.getNextInvoiceNo('INV', branch.code || 'BR');

      const customerSnapshot = {
        name: customer.name,
        mobile: customer.mobile,
        address: `${customer.address?.street || ''} ${customer.address?.city || ''}`.trim(),
        gstin: customer.gstin || '',
        state: customer.address?.state || '',
        stateCode: customer.address?.stateCode || '07'
      };

      const invoice = new Invoice({
        invoiceNo,
        billType: BILL_TYPES.PAKKA,
        invoiceDate: new Date(),
        customerId: customer._id,
        customerSnapshot,
        branchId,
        createdBy: userId,
        items: calculation.items,
        subtotal: calculation.subtotal,
        discount: calculation.discount,
        taxableAmount: calculation.taxableAmount,
        tax: calculation.tax,
        roundOff: calculation.roundOff,
        grandTotal: calculation.grandTotal,
        paymentSummary: {
          paid: 0,
          due: calculation.grandTotal,
          exchangeAdjusted: 0
        },
        status,
        paymentStatus: 'PENDING',
        notes
      });

      await invoice.save({ session });

      // Deduct inventory stock if bill is CONFIRMED
      if (status === INVOICE_STATUSES.CONFIRMED) {
        for (const item of calculation.items) {
          if (item.barcode || item.productId) {
            await InventoryService.deductItemForSale({
              barcode: item.barcode,
              productId: item.productId,
              branchId,
              quantity: item.quantity || 1,
              invoiceId: invoice._id,
              performedBy: userId,
              session
            });
          }
        }

        // Post Debit to Customer Ledger
        await LedgerService.postCustomerEntry({
          customerId: customer._id,
          entryType: 'SALE',
          referenceType: 'Invoice',
          referenceId: invoice._id,
          description: `GST Invoice #${invoice.invoiceNo}`,
          debit: invoice.grandTotal,
          branchId,
          createdBy: userId,
          session
        });
      }

      // Process initial checkout payments if provided
      if (payments && payments.length > 0) {
        for (const p of payments) {
          if (p.amount > 0) {
            await PaymentService.recordPayment({
              referenceType: 'INVOICE',
              referenceId: invoice._id,
              entityType: 'CUSTOMER',
              entityId: customer._id,
              amount: p.amount,
              paymentMode: p.paymentMode,
              modeDetails: p.modeDetails || {},
              branchId,
              recordedBy: userId,
              notes: `Checkout payment for GST Invoice ${invoice.invoiceNo}`,
              session
            });
          }
        }
      }

      const finalInvoice = await Invoice.findById(invoice._id).session(session);

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.CREATE,
          module: 'INVOICE',
          recordId: invoice._id,
          newValue: finalInvoice.toObject(),
          branchId
        },
        session
      );

      return finalInvoice;
    });
  }

  /**
   * Convert Kacha Bill -> Pakka Bill (GST Invoice)
   */
  static async convertKachaToPakka({ kachaBillId, userId }) {
    return await withTransaction(async (session) => {
      const kachaBill = await Invoice.findById(kachaBillId).session(session);
      if (!kachaBill) {
        throw ApiError.notFound('Kacha bill not found');
      }

      if (kachaBill.billType !== BILL_TYPES.KACHA) {
        throw ApiError.badRequest('Only KACHA bills can be converted to PAKKA bills');
      }

      if (kachaBill.status === INVOICE_STATUSES.CONVERTED) {
        throw ApiError.badRequest(`This Kacha bill has already been converted to Pakka Bill (Ref: ${kachaBill.convertedToPakkaBillId})`);
      }

      if (kachaBill.status === INVOICE_STATUSES.CANCELLED) {
        throw ApiError.badRequest('Cannot convert a CANCELLED Kacha bill');
      }

      const branch = await Branch.findById(kachaBill.branchId).session(session);
      const customer = await Customer.findById(kachaBill.customerId).session(session);

      // Recalculate with GST
      const calculation = CalculationService.calculateInvoiceTotals({
        items: kachaBill.items.map((i) => i.toObject()),
        billType: BILL_TYPES.PAKKA,
        branchStateCode: branch.address?.stateCode || '07',
        customerStateCode: customer?.address?.stateCode || kachaBill.customerSnapshot?.stateCode || '07',
        extraDiscount: kachaBill.discount
      });

      const newInvoiceNo = await this.getNextInvoiceNo('INV', branch?.code || 'BR');

      // Create Pakka Bill
      const pakkaInvoice = new Invoice({
        invoiceNo: newInvoiceNo,
        billType: BILL_TYPES.PAKKA,
        invoiceDate: new Date(),
        customerId: kachaBill.customerId,
        customerSnapshot: kachaBill.customerSnapshot,
        branchId: kachaBill.branchId,
        createdBy: userId,
        items: calculation.items,
        subtotal: calculation.subtotal,
        discount: calculation.discount,
        taxableAmount: calculation.taxableAmount,
        tax: calculation.tax,
        roundOff: calculation.roundOff,
        grandTotal: calculation.grandTotal,
        paymentSummary: {
          paid: kachaBill.paymentSummary.paid,
          due: Math.max(0, DecimalUtil.subtract(calculation.grandTotal, kachaBill.paymentSummary.paid)),
          exchangeAdjusted: kachaBill.paymentSummary.exchangeAdjusted
        },
        status: INVOICE_STATUSES.CONFIRMED,
        paymentStatus:
          kachaBill.paymentSummary.paid >= calculation.grandTotal
            ? 'PAID'
            : kachaBill.paymentSummary.paid > 0
            ? 'PARTIAL'
            : 'PENDING',
        convertedFromKachaBillId: kachaBill._id,
        notes: `Converted from Kacha Bill #${kachaBill.invoiceNo}. ${kachaBill.notes || ''}`
      });

      await pakkaInvoice.save({ session });

      // Transfer payment records linked to Kacha bill to point to new Pakka invoice
      await Payment.updateMany(
        { referenceType: 'INVOICE', referenceId: kachaBill._id },
        { referenceId: pakkaInvoice._id, notes: `Transferred from Kacha ${kachaBill.invoiceNo}` },
        { session }
      );

      // Adjust customer ledger:
      // The customer ledger already had debit for kachaBill.grandTotal.
      // Now the total is pakkaInvoice.grandTotal.
      // Difference = pakkaInvoice.grandTotal - kachaBill.grandTotal (usually the tax amount).
      const ledgerDifference = DecimalUtil.subtract(pakkaInvoice.grandTotal, kachaBill.grandTotal);
      if (ledgerDifference > 0) {
        await LedgerService.postCustomerEntry({
          customerId: kachaBill.customerId,
          entryType: 'ADJUSTMENT',
          referenceType: 'Invoice',
          referenceId: pakkaInvoice._id,
          description: `GST differential on conversion Kacha ${kachaBill.invoiceNo} -> Pakka ${pakkaInvoice.invoiceNo}`,
          debit: ledgerDifference,
          branchId: kachaBill.branchId,
          createdBy: userId,
          session
        });
      }

      // Mark original Kacha bill as CONVERTED
      kachaBill.status = INVOICE_STATUSES.CONVERTED;
      kachaBill.convertedToPakkaBillId = pakkaInvoice._id;
      await kachaBill.save({ session });

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.CONVERT,
          module: 'INVOICE',
          recordId: kachaBill._id,
          oldValue: { status: 'CONFIRMED' },
          newValue: { status: 'CONVERTED', convertedToPakkaBillId: pakkaInvoice._id },
          branchId: kachaBill.branchId
        },
        session
      );

      return pakkaInvoice;
    });
  }

  /**
   * Cancel an Invoice (Restores inventory stock and reverses ledger)
   */
  static async cancelInvoice({ invoiceId, reason, userId }) {
    return await withTransaction(async (session) => {
      const invoice = await Invoice.findById(invoiceId).session(session);
      if (!invoice) {
        throw ApiError.notFound('Invoice not found');
      }

      if (invoice.status === INVOICE_STATUSES.CANCELLED) {
        throw ApiError.badRequest('Invoice is already cancelled');
      }

      if (invoice.status === INVOICE_STATUSES.CONVERTED) {
        throw ApiError.badRequest('Cannot cancel a Kacha bill that has already been converted to Pakka');
      }

      // 1. Restore Stock to Inventory
      for (const item of invoice.items) {
        if (item.barcode || item.productId) {
          await InventoryService.restoreItemStock({
            barcode: item.barcode,
            productId: item.productId,
            branchId: invoice.branchId,
            quantity: item.quantity,
            netWeight: item.netWeight,
            referenceType: 'Invoice',
            referenceId: invoice._id,
            performedBy: userId,
            reason: `Invoice ${invoice.invoiceNo} cancelled: ${reason}`,
            session
          });
        }
      }

      // 2. Reverse Customer Ledger
      // The original invoice debited the customer. Cancellation credits the customer back.
      await LedgerService.postCustomerEntry({
        customerId: invoice.customerId,
        entryType: 'ADJUSTMENT',
        referenceType: 'Invoice',
        referenceId: invoice._id,
        description: `Cancellation of Invoice #${invoice.invoiceNo}: ${reason}`,
        credit: invoice.grandTotal, // Reverses original debit
        branchId: invoice.branchId,
        createdBy: userId,
        session
      });

      // 3. Mark invoice as CANCELLED
      invoice.status = INVOICE_STATUSES.CANCELLED;
      invoice.cancellationReason = reason;
      invoice.cancelledAt = new Date();
      invoice.cancelledBy = userId;
      await invoice.save({ session });

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.CANCEL,
          module: 'INVOICE',
          recordId: invoice._id,
          newValue: { status: 'CANCELLED', reason },
          branchId: invoice.branchId
        },
        session
      );

      return invoice;
    });
  }
}

module.exports = BillingService;
