const Invoice = require('../models/Invoice');
const SalesReturn = require('../models/SalesReturn');
const InventoryService = require('../services/inventory.service');
const LedgerService = require('../services/ledger.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const DecimalUtil = require('../utils/decimal');
const BarcodeGenerator = require('../utils/barcodeGenerator');
const { withTransaction } = require('../utils/transaction');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS, INVOICE_STATUSES } = require('../config/constants');

class SalesController {
  static async getSales(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = { status: { $nin: [INVOICE_STATUSES.CANCELLED, INVOICE_STATUSES.DRAFT] } };
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.billType) query.billType = req.query.billType;
      if (req.query.customerId) query.customerId = req.query.customerId;

      const [sales, total] = await Promise.all([
        Invoice.find(query).skip(skip).limit(limit).sort({ invoiceDate: -1 }),
        Invoice.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Sales invoices fetched', sales, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSaleById(req, res, next) {
    try {
      const sale = await Invoice.findById(req.params.id)
        .populate('customerId')
        .populate('branchId')
        .populate('createdBy', 'name');

      if (!sale) {
        throw ApiError.notFound('Sale record not found');
      }
      return ApiResponse.success(res, 'Sale details', sale);
    } catch (error) {
      next(error);
    }
  }

  static async recordSalesReturn(req, res, next) {
    try {
      const { items, refundType = 'LEDGER_CREDIT', reason } = req.body;
      const invoiceId = req.params.id;

      const salesReturn = await withTransaction(async (session) => {
        const invoice = await Invoice.findById(invoiceId).session(session);
        if (!invoice) {
          throw ApiError.notFound('Original invoice not found');
        }

        if (invoice.status === INVOICE_STATUSES.CANCELLED) {
          throw ApiError.badRequest('Cannot process return on a CANCELLED invoice');
        }

        let totalRefundAmount = 0;
        for (const item of items) {
          totalRefundAmount = DecimalUtil.add(totalRefundAmount, item.amount);

          // 1. Restore item back to inventory
          await InventoryService.restoreItemStock({
            barcode: item.barcode,
            productId: item.productId,
            branchId: invoice.branchId,
            quantity: item.quantity || 1,
            netWeight: item.netWeight,
            referenceType: 'SalesReturn',
            referenceId: invoice._id,
            performedBy: req.user._id,
            reason: `Return against invoice ${invoice.invoiceNo}: ${reason}`,
            session
          });
        }

        const returnNo = BarcodeGenerator.generateInvoiceNo('SRET', 'BR', Math.floor(1000 + Math.random() * 9000));

        const returnDoc = new SalesReturn({
          returnNo,
          invoiceId: invoice._id,
          customerId: invoice.customerId,
          returnDate: new Date(),
          items,
          totalRefundAmount,
          refundType,
          reason,
          branchId: invoice.branchId,
          createdBy: req.user._id
        });

        await returnDoc.save({ session });

        // 2. Adjust Customer Ledger:
        // Return decreases customer debt (receivable)
        await LedgerService.postCustomerEntry({
          customerId: invoice.customerId,
          entryType: 'RETURN',
          referenceType: 'SalesReturn',
          referenceId: returnDoc._id,
          description: `Sales Return #${returnDoc.returnNo} against Invoice #${invoice.invoiceNo}`,
          credit: totalRefundAmount,
          branchId: invoice.branchId,
          createdBy: req.user._id,
          session
        });

        await logAudit(
          {
            userId: req.user._id,
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

      return ApiResponse.created(res, 'Sales return recorded and stock restored', salesReturn);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SalesController;
