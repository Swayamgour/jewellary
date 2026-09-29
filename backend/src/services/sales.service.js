const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const SalesReturn = require('../models/SalesReturn');
const Branch = require('../models/Branch');
const InventoryService = require('./inventory.service');
const LedgerService = require('./ledger.service');
const PaymentService = require('./payment.service');
const InvoiceAccounting = require('./invoiceAccounting.service');
const { computeInvoiceReturnLine, returnStatusFor } = require('../utils/accounting');
const { withTransaction } = require('../utils/transaction');
const { logAudit } = require('../utils/auditLogger');
const { nextDocNo } = require('../utils/sequence');
const ApiError = require('../utils/apiError');
const DecimalUtil = require('../utils/decimal');
const { INVOICE_STATUSES, LIVE_INVOICE_STATUSES, AUDIT_ACTIONS } = require('../config/constants');

const CASH_REFUND_TYPES = ['CASH', 'UPI', 'BANK_TRANSFER'];

/**
 * Sales return / credit note lifecycle
 *
 *   validate invoice  -> validate lines & quantities (no duplicate / excess returns)
 *   -> value the goods server-side (line price after discount + its GST share)
 *   -> restore inventory -> credit the customer ledger -> settle:
 *          1. reduce what the customer still owes on the bill
 *          2. whatever was already paid is refunded (CASH / UPI / BANK_TRANSFER) or kept as credit (LEDGER_CREDIT)
 *   -> update invoice returned amounts / returnStatus -> audit
 */
class SalesService {
  static async createReturn({ invoiceId, items, refundType = 'LEDGER_CREDIT', refundModeDetails = {}, reason, userId }) {
    if (!items || items.length === 0) {
      throw ApiError.badRequest('At least one item must be returned');
    }

    return withTransaction(async (session) => {
      const invoice = await Invoice.findById(invoiceId).session(session);
      if (!invoice) throw ApiError.notFound('Original invoice not found');

      if (invoice.status === INVOICE_STATUSES.CANCELLED) {
        throw ApiError.badRequest('Cannot process return on a CANCELLED invoice');
      }
      if (invoice.status === INVOICE_STATUSES.CONVERTED) {
        throw ApiError.badRequest('This Kacha bill was converted to a Pakka invoice. Process the return on the Pakka invoice.');
      }
      if (invoice.status === INVOICE_STATUSES.DRAFT || !LIVE_INVOICE_STATUSES.includes(invoice.status)) {
        throw ApiError.badRequest(`Cannot process a return on a ${invoice.status} invoice`);
      }

      const branch = await Branch.findById(invoice.branchId).select('code').session(session);

      // Merge repeated lines from the request, then locate each invoice line
      const wanted = new Map();
      for (const req of items) {
        const line = invoice.items.find((l) =>
          req.invoiceItemId ? l._id.toString() === req.invoiceItemId.toString() : req.barcode && l.barcode === req.barcode.toUpperCase()
        );
        if (!line) {
          throw ApiError.badRequest(`Item ${req.invoiceItemId || req.barcode} was not sold on invoice ${invoice.invoiceNo}`);
        }
        const key = line._id.toString();
        wanted.set(key, (wanted.get(key) || 0) + (req.quantity || 1));
      }

      const returnId = new mongoose.Types.ObjectId();
      const returnItems = [];
      let totalTaxable = 0;
      let totalTax = 0;
      let totalAmount = 0;

      // position BEFORE this return (to know how much extra money we end up holding)
      await InvoiceAccounting.recompute(invoice, session, { save: false });
      const excessBefore = invoice.paymentSummary.excessReceived || 0;

      for (const [lineId, qty] of wanted) {
        const line = invoice.items.id(lineId);
        let value;
        try {
          value = computeInvoiceReturnLine(invoice, line, qty);
        } catch (e) {
          throw ApiError.badRequest(`${line.productName} (${line.barcode}): ${e.message}`);
        }

        line.returnedQty = (line.returnedQty || 0) + qty;
        line.returnedTaxable = DecimalUtil.add(line.returnedTaxable || 0, value.taxable);
        line.returnedTax = DecimalUtil.add(line.returnedTax || 0, value.tax);

        await InventoryService.restoreItemStock({
          inventoryId: line.inventoryId,
          barcode: line.barcode,
          quantity: qty,
          referenceType: 'SalesReturn',
          referenceId: returnId,
          performedBy: userId,
          reason: `Return against invoice ${invoice.invoiceNo}: ${reason}`,
          session
        });

        totalTaxable = DecimalUtil.add(totalTaxable, value.taxable);
        totalTax = DecimalUtil.add(totalTax, value.tax);
        totalAmount = DecimalUtil.add(totalAmount, value.amount);

        returnItems.push({
          invoiceItemId: line._id,
          inventoryId: line.inventoryId,
          productId: line.productId,
          barcode: line.barcode,
          productName: line.productName,
          metal: line.metal,
          purity: line.purity,
          grossWeight: line.grossWeight,
          stoneWeight: line.stoneWeight,
          netWeight: line.netWeight,
          quantity: qty,
          taxableAmount: value.taxable,
          taxAmount: value.tax,
          amount: value.amount,
          costAmount: DecimalUtil.roundCurrency((line.unitCost || 0) * qty)
        });
      }

      // When the last unit comes back the customer gets exactly the invoice total (round-off included)
      let roundOff = 0;
      if (returnStatusFor(invoice.items) === 'FULL') {
        const exact = Math.max(0, DecimalUtil.subtract(invoice.grandTotal, invoice.returnedAmount || 0));
        roundOff = DecimalUtil.subtract(exact, totalAmount);
        totalAmount = exact;
      }

      invoice.returnedAmount = DecimalUtil.add(invoice.returnedAmount || 0, totalAmount);
      invoice.returnedTaxable = DecimalUtil.add(invoice.returnedTaxable || 0, totalTaxable);

      // position AFTER the return, before any refund is paid
      await InvoiceAccounting.recompute(invoice, session, { save: false });
      const refundable = Math.max(0, DecimalUtil.subtract(invoice.paymentSummary.excessReceived || 0, excessBefore));
      const adjustedAgainstDue = DecimalUtil.subtract(totalAmount, refundable);

      const returnNo = await nextDocNo('SRET', branch?.code || 'BR', session, { model: SalesReturn, field: 'returnNo' });

      const returnDoc = new SalesReturn({
        _id: returnId,
        returnNo,
        invoiceId: invoice._id,
        invoiceNo: invoice.invoiceNo,
        customerId: invoice.customerId,
        returnDate: new Date(),
        items: returnItems,
        totalTaxable,
        totalTax,
        totalRefundAmount: totalAmount,
        roundOff,
        refundType,
        settlement: { adjustedAgainstDue, cashRefunded: 0, creditRetained: refundable },
        reason,
        branchId: invoice.branchId,
        createdBy: userId
      });
      await returnDoc.save({ session });

      // Credit note: the customer owes less
      await LedgerService.postCustomerEntry({
        customerId: invoice.customerId,
        entryType: 'RETURN',
        referenceType: 'SalesReturn',
        referenceId: returnDoc._id,
        description: `Sales Return #${returnDoc.returnNo} against Invoice #${invoice.invoiceNo}`,
        credit: totalAmount,
        branchId: invoice.branchId,
        createdBy: userId,
        session
      });

      // Pay the refundable part back if a cash-type refund was chosen
      if (CASH_REFUND_TYPES.includes(refundType) && refundable > 0) {
        const payment = await PaymentService.recordPayment({
          referenceType: 'INVOICE',
          referenceId: invoice._id,
          entityType: 'CUSTOMER',
          entityId: invoice.customerId,
          amount: refundable,
          paymentMode: refundType,
          modeDetails: refundModeDetails,
          direction: 'OUT',
          linkedDocType: 'SALES_RETURN',
          linkedDocId: returnDoc._id,
          branchId: invoice.branchId,
          recordedBy: userId,
          notes: `Refund for sales return ${returnDoc.returnNo}`,
          internal: true,
          invoiceDoc: invoice,
          session
        });
        returnDoc.settlement.cashRefunded = refundable;
        returnDoc.settlement.creditRetained = 0;
        returnDoc.refundPaymentId = payment._id;
        await returnDoc.save({ session });
      } else {
        await invoice.save({ session });
      }

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.RETURN,
          module: 'SALES_RETURN',
          recordId: returnDoc._id,
          newValue: returnDoc.toObject(),
          branchId: invoice.branchId
        },
        session
      );

      return returnDoc;
    });
  }
}

module.exports = SalesService;
