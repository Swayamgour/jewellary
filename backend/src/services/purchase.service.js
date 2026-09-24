const Purchase = require('../models/Purchase');
const PurchaseReturn = require('../models/PurchaseReturn');
const Vendor = require('../models/Vendor');
const Branch = require('../models/Branch');
const InventoryService = require('./inventory.service');
const LedgerService = require('./ledger.service');
const PaymentService = require('./payment.service');
const BarcodeGenerator = require('../utils/barcodeGenerator');
const DecimalUtil = require('../utils/decimal');
const ApiError = require('../utils/apiError');
const { withTransaction } = require('../utils/transaction');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS } = require('../config/constants');

class PurchaseService {
  /**
   * Record new purchase entry
   */
  static async recordPurchase({
    vendorId,
    vendorInvoiceNo = '',
    branchId,
    purchaseDate = new Date(),
    items = [],
    taxAmount = 0,
    paidAmount = 0,
    paymentMode = 'BANK_TRANSFER',
    notes = '',
    userId
  }) {
    return await withTransaction(async (session) => {
      const vendor = await Vendor.findById(vendorId).session(session);
      if (!vendor) {
        throw ApiError.notFound('Vendor not found');
      }

      const branch = await Branch.findById(branchId).session(session);
      if (!branch) {
        throw ApiError.notFound('Branch not found');
      }

      if (!items || items.length === 0) {
        throw ApiError.badRequest('Purchase entry must contain at least one item');
      }

      let subtotal = 0;
      const processedItems = items.map((item) => {
        const grossWeight = DecimalUtil.roundWeight(item.grossWeight);
        const stoneWeight = DecimalUtil.roundWeight(item.stoneWeight || 0);
        const netWeight = DecimalUtil.subtract(grossWeight, stoneWeight);
        const rate = DecimalUtil.roundCurrency(item.rate);
        const makingAmount = DecimalUtil.roundCurrency(item.makingAmount || 0);
        const otherCharges = DecimalUtil.roundCurrency(item.otherCharges || 0);

        const goldVal = DecimalUtil.multiply(netWeight, rate);
        const taxable = DecimalUtil.add(goldVal, makingAmount, otherCharges);
        const itemTax = DecimalUtil.roundCurrency(item.taxAmount || 0);
        const total = DecimalUtil.add(taxable, itemTax);

        subtotal = DecimalUtil.add(subtotal, taxable);

        const barcode = item.barcode || BarcodeGenerator.generate('PUR');

        return {
          ...item,
          barcode,
          grossWeight,
          stoneWeight,
          netWeight,
          rate,
          makingAmount,
          otherCharges,
          taxableAmount: taxable,
          taxAmount: itemTax,
          totalAmount: total
        };
      });

      const grandTotalPre = DecimalUtil.add(subtotal, taxAmount);
      const { roundedAmount, roundOffDiff } = DecimalUtil.roundToRupee(grandTotalPre);

      const purchaseNo = await BarcodeGenerator.generateInvoiceNo('PUR', branch.code || 'BR', Math.floor(1000 + Math.random() * 9000));

      const purchase = new Purchase({
        purchaseNo,
        vendorInvoiceNo,
        vendorId,
        purchaseDate,
        items: processedItems,
        subtotal,
        taxAmount,
        roundOff: roundOffDiff,
        grandTotal: roundedAmount,
        paidAmount: 0,
        dueAmount: roundedAmount,
        paymentStatus: 'PENDING',
        status: 'COMPLETED',
        branchId,
        createdBy: userId,
        notes
      });

      await purchase.save({ session });

      // 1. Add Stock to Inventory for each item
      for (const item of processedItems) {
        await InventoryService.addStockFromPurchase({
          itemData: item,
          purchaseId: purchase._id,
          branchId,
          performedBy: userId,
          session
        });
      }

      // 2. Post Credit to Vendor Ledger (We owe vendor money)
      await LedgerService.postVendorEntry({
        vendorId,
        entryType: 'PURCHASE',
        referenceType: 'Purchase',
        referenceId: purchase._id,
        description: `Purchase #${purchase.purchaseNo} (Vendor Bill: ${vendorInvoiceNo || 'N/A'})`,
        credit: roundedAmount,
        branchId,
        createdBy: userId,
        session
      });

      // 3. Process immediate payment if specified
      if (paidAmount > 0) {
        await PaymentService.recordPayment({
          referenceType: 'PURCHASE',
          referenceId: purchase._id,
          entityType: 'VENDOR',
          entityId: vendorId,
          amount: paidAmount,
          paymentMode,
          branchId,
          recordedBy: userId,
          notes: `Payment for Purchase #${purchase.purchaseNo}`,
          session
        });

        purchase.paidAmount = paidAmount;
        purchase.dueAmount = Math.max(0, DecimalUtil.subtract(roundedAmount, paidAmount));
        purchase.paymentStatus = purchase.dueAmount === 0 ? 'PAID' : 'PARTIAL';
        await purchase.save({ session });
      }

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.CREATE,
          module: 'PURCHASE',
          recordId: purchase._id,
          newValue: purchase.toObject(),
          branchId
        },
        session
      );

      return purchase;
    });
  }

  /**
   * Process Purchase Return
   */
  static async recordPurchaseReturn({
    purchaseId,
    items,
    reason,
    branchId,
    userId
  }) {
    return await withTransaction(async (session) => {
      const purchase = await Purchase.findById(purchaseId).session(session);
      if (!purchase) {
        throw ApiError.notFound('Purchase order not found');
      }

      if (!items || items.length === 0) {
        throw ApiError.badRequest('At least one item must be returned');
      }

      let totalReturnAmount = 0;
      for (const item of items) {
        totalReturnAmount = DecimalUtil.add(totalReturnAmount, item.amount);
        // Deduct inventory
        await InventoryService.deductForPurchaseReturn({
          barcode: item.barcode,
          quantity: item.quantity || 1,
          returnId: purchase._id,
          branchId,
          performedBy: userId,
          reason,
          session
        });
      }

      const returnNo = BarcodeGenerator.generateInvoiceNo('PRET', 'BR', Math.floor(1000 + Math.random() * 9000));

      const purchaseReturn = new PurchaseReturn({
        returnNo,
        purchaseId: purchase._id,
        vendorId: purchase.vendorId,
        returnDate: new Date(),
        items,
        totalAmount: totalReturnAmount,
        reason,
        branchId,
        createdBy: userId
      });

      await purchaseReturn.save({ session });

      // Post Debit to Vendor Ledger (Reduces payable)
      await LedgerService.postVendorEntry({
        vendorId: purchase.vendorId,
        entryType: 'RETURN',
        referenceType: 'PurchaseReturn',
        referenceId: purchaseReturn._id,
        description: `Purchase Return #${purchaseReturn.returnNo} for Purchase #${purchase.purchaseNo}`,
        debit: totalReturnAmount,
        branchId,
        createdBy: userId,
        session
      });

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.RETURN,
          module: 'PURCHASE_RETURN',
          recordId: purchaseReturn._id,
          newValue: purchaseReturn.toObject(),
          branchId
        },
        session
      );

      return purchaseReturn;
    });
  }
}

module.exports = PurchaseService;
