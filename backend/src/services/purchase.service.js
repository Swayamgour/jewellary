const Purchase = require('../models/Purchase');
const PurchaseReturn = require('../models/PurchaseReturn');
const Vendor = require('../models/Vendor');
const Branch = require('../models/Branch');
const Payment = require('../models/Payment');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const InventoryService = require('./inventory.service');
const LedgerService = require('./ledger.service');
const PaymentService = require('./payment.service');
const PurchaseAccounting = require('./purchaseAccounting.service');
const BarcodeGenerator = require('../utils/barcodeGenerator');
const DecimalUtil = require('../utils/decimal');
const ApiError = require('../utils/apiError');
const { computePurchaseReturnLine, returnStatusFor, allocateByShare } = require('../utils/accounting');
const { withTransaction } = require('../utils/transaction');
const { logAudit } = require('../utils/auditLogger');
const { nextDocNo } = require('../utils/sequence');
const { PURCHASE_STATUSES, PAYMENT_ACTIONS, STOCK_MOVEMENT_TYPES, INVENTORY_STATUSES, AUDIT_ACTIONS } = require('../config/constants');

/**
 * Purchase lifecycle
 *
 *   DRAFT ──confirm──> COMPLETED ──(payments / returns / vendor refunds)──> CANCELLED
 *
 *   DRAFT      : editable, nothing posted (no stock, no ledger)
 *   COMPLETED  : stock added (per-unit weights x quantity), vendor ledger credited, payments allowed
 *   Return     : stock leaves, vendor ledger debited, purchase paid/due/refund position re-derived
 *   Cancel     : only while none of the received stock has been sold / moved / returned
 *
 * Purchase Orders (see purchaseOrder.service.js) create COMPLETED purchases when goods are received.
 */
class PurchaseService {
  // ------------------------------------------------------------ line maths

  /**
   * Weights are per unit; rate is per gram; makingAmount / otherCharges / taxAmount are for the whole line.
   */
  static buildLines(items, docLevelTax = 0) {
    if (!items || items.length === 0) {
      throw ApiError.badRequest('Purchase entry must contain at least one item');
    }

    const seen = new Set();
    const lines = items.map((item) => {
      const grossWeight = DecimalUtil.roundWeight(item.grossWeight);
      const stoneWeight = DecimalUtil.roundWeight(item.stoneWeight || 0);
      if (grossWeight < stoneWeight) {
        throw ApiError.badRequest(`${item.productName}: gross weight cannot be less than stone weight`);
      }
      const netWeight = DecimalUtil.roundWeight(grossWeight - stoneWeight);
      const quantity = parseInt(item.quantity || 1, 10);
      const rate = DecimalUtil.roundCurrency(item.rate);
      const makingAmount = DecimalUtil.roundCurrency(item.makingAmount || 0);
      const otherCharges = DecimalUtil.roundCurrency(item.otherCharges || 0);

      const metalValue = DecimalUtil.multiply(DecimalUtil.multiply(netWeight, quantity, 3), rate);
      const taxable = DecimalUtil.add(metalValue, makingAmount, otherCharges);
      const gstRate = item.gstRate || 0;
      const taxAmount = gstRate > 0 ? DecimalUtil.percentage(taxable, gstRate) : DecimalUtil.roundCurrency(item.taxAmount || 0);

      const barcode = (item.barcode || BarcodeGenerator.generate('PUR')).toUpperCase();
      if (seen.has(barcode)) throw ApiError.badRequest(`Barcode ${barcode} is used twice in this purchase`);
      seen.add(barcode);

      return {
        productId: item.productId,
        purchaseOrderItemId: item.purchaseOrderItemId,
        productName: item.productName,
        categoryId: item.categoryId,
        barcode,
        metal: item.metal,
        purity: item.purity,
        grossWeight,
        stoneWeight,
        netWeight,
        quantity,
        rate,
        makingAmount,
        otherCharges,
        taxableAmount: taxable,
        gstRate,
        taxAmount,
        totalAmount: DecimalUtil.add(taxable, taxAmount),
        unitCost: DecimalUtil.divide(taxable, quantity)
      };
    });

    // Older clients sent one tax figure for the whole bill - spread it over the lines pro-rata
    const lineTax = lines.reduce((a, l) => DecimalUtil.add(a, l.taxAmount), 0);
    if (lineTax === 0 && docLevelTax > 0) {
      const shares = allocateByShare(docLevelTax, lines.map((l) => l.taxableAmount));
      lines.forEach((l, i) => {
        l.taxAmount = shares[i];
        l.totalAmount = DecimalUtil.add(l.taxableAmount, shares[i]);
      });
    }

    const subtotal = lines.reduce((a, l) => DecimalUtil.add(a, l.taxableAmount), 0);
    const taxAmount = lines.reduce((a, l) => DecimalUtil.add(a, l.taxAmount), 0);
    const { roundedAmount, roundOffDiff } = DecimalUtil.roundToRupee(DecimalUtil.add(subtotal, taxAmount));

    return { lines, subtotal, taxAmount, roundOff: roundOffDiff, grandTotal: roundedAmount };
  }

  static async post({ purchase, userId, paidAmount = 0, paymentMode = 'BANK_TRANSFER', modeDetails = {}, session }) {
    // 1. stock in
    for (const item of purchase.items) {
      const inv = await InventoryService.addStockFromPurchase({
        itemData: item.toObject ? item.toObject() : item,
        purchaseId: purchase._id,
        branchId: purchase.branchId,
        performedBy: userId,
        session
      });
      item.inventoryId = inv._id;
    }
    purchase.postedAt = new Date();
    purchase.status = PURCHASE_STATUSES.COMPLETED;
    await purchase.save({ session });

    // 2. we owe the vendor
    await LedgerService.postVendorEntry({
      vendorId: purchase.vendorId,
      entryType: 'PURCHASE',
      referenceType: 'Purchase',
      referenceId: purchase._id,
      description: `Purchase #${purchase.purchaseNo} (Vendor Bill: ${purchase.vendorInvoiceNo || 'N/A'})`,
      credit: purchase.grandTotal,
      branchId: purchase.branchId,
      createdBy: userId,
      session
    });

    // 3. immediate payment
    if (paidAmount > 0) {
      await PaymentService.recordPayment({
        referenceType: 'PURCHASE',
        referenceId: purchase._id,
        entityType: 'VENDOR',
        entityId: purchase.vendorId,
        amount: paidAmount,
        paymentMode,
        modeDetails,
        branchId: purchase.branchId,
        recordedBy: userId,
        notes: `Payment for Purchase #${purchase.purchaseNo}`,
        purchaseDoc: purchase,
        session
      });
    } else {
      await PurchaseAccounting.recompute(purchase, session);
    }
  }

  /**
   * Stock rows need a category. If the caller did not send one, take it from the product design.
   */
  static async attachCategories(items, session) {
    const missing = (items || []).filter((i) => i.productId && !i.categoryId);
    if (missing.length === 0) return items;
    const products = await Product.find({ _id: { $in: missing.map((i) => i.productId) } }).select('categoryId').session(session);
    const map = new Map(products.map((p) => [String(p._id), p.categoryId]));
    return items.map((i) => (i.categoryId || !i.productId ? i : { ...i, categoryId: map.get(String(i.productId)) }));
  }

  // ------------------------------------------------------------ create

  static async recordPurchase({
    vendorId,
    vendorInvoiceNo = '',
    branchId,
    purchaseDate = new Date(),
    items = [],
    taxAmount = 0,
    paidAmount = 0,
    paymentMode = 'BANK_TRANSFER',
    modeDetails = {},
    notes = '',
    userId,
    status = PURCHASE_STATUSES.COMPLETED,
    purchaseOrderId = undefined,
    session: outerSession = null
  }) {
    if (![PURCHASE_STATUSES.DRAFT, PURCHASE_STATUSES.COMPLETED].includes(status)) {
      throw ApiError.badRequest('A new purchase can only be created as DRAFT or COMPLETED');
    }
    if (status === PURCHASE_STATUSES.DRAFT && paidAmount > 0) {
      throw ApiError.badRequest('Payments cannot be recorded on a DRAFT purchase. Confirm it first.');
    }

    return withTransaction(async (session) => {
      const vendor = await Vendor.findById(vendorId).session(session);
      if (!vendor) throw ApiError.notFound('Vendor not found');
      const branch = await Branch.findById(branchId).session(session);
      if (!branch) throw ApiError.notFound('Branch not found');

      const built = this.buildLines(await this.attachCategories(items, session), taxAmount);
      if (paidAmount > built.grandTotal) {
        throw ApiError.badRequest(`Paid amount (${paidAmount}) cannot exceed purchase total (${built.grandTotal})`);
      }

      const isDraft = status === PURCHASE_STATUSES.DRAFT;
      const purchaseNo = await nextDocNo(isDraft ? 'PDR' : 'PUR', branch.code || 'BR', session, { model: Purchase, field: 'purchaseNo' });

      const purchase = new Purchase({
        purchaseNo,
        vendorInvoiceNo,
        vendorId,
        purchaseOrderId,
        purchaseDate,
        items: built.lines,
        subtotal: built.subtotal,
        taxAmount: built.taxAmount,
        roundOff: built.roundOff,
        grandTotal: built.grandTotal,
        paidAmount: 0,
        dueAmount: built.grandTotal,
        adjustedTotal: built.grandTotal,
        paymentStatus: 'PENDING',
        status,
        branchId,
        createdBy: userId,
        notes
      });
      await purchase.save({ session });

      if (!isDraft) {
        await this.post({ purchase, userId, paidAmount, paymentMode, modeDetails, session });
      }

      await logAudit(
        { userId, action: AUDIT_ACTIONS.CREATE, module: 'PURCHASE', recordId: purchase._id, newValue: purchase.toObject(), branchId },
        session
      );
      return purchase;
    }, { session: outerSession });
  }

  static async updateDraft({ purchaseId, vendorId, vendorInvoiceNo, purchaseDate, items, taxAmount, notes, userId }) {
    return withTransaction(async (session) => {
      const purchase = await Purchase.findById(purchaseId).session(session);
      if (!purchase) throw ApiError.notFound('Purchase not found');
      if (purchase.status !== PURCHASE_STATUSES.DRAFT) {
        throw ApiError.badRequest(`Only DRAFT purchases can be edited (this one is ${purchase.status})`);
      }
      if (vendorId) {
        const vendor = await Vendor.findById(vendorId).session(session);
        if (!vendor) throw ApiError.notFound('Vendor not found');
        purchase.vendorId = vendorId;
      }
      if (vendorInvoiceNo !== undefined) purchase.vendorInvoiceNo = vendorInvoiceNo;
      if (purchaseDate) purchase.purchaseDate = purchaseDate;
      if (notes !== undefined) purchase.notes = notes;
      if (items) {
        const built = this.buildLines(await this.attachCategories(items, session), taxAmount || 0);
        purchase.items = built.lines;
        purchase.subtotal = built.subtotal;
        purchase.taxAmount = built.taxAmount;
        purchase.roundOff = built.roundOff;
        purchase.grandTotal = built.grandTotal;
        purchase.dueAmount = built.grandTotal;
        purchase.adjustedTotal = built.grandTotal;
      }
      await purchase.save({ session });
      await logAudit(
        { userId, action: AUDIT_ACTIONS.UPDATE, module: 'PURCHASE', recordId: purchase._id, newValue: { grandTotal: purchase.grandTotal }, branchId: purchase.branchId },
        session
      );
      return purchase;
    });
  }

  static async confirmDraft({ purchaseId, paidAmount = 0, paymentMode = 'BANK_TRANSFER', modeDetails = {}, userId }) {
    return withTransaction(async (session) => {
      const purchase = await Purchase.findById(purchaseId).session(session);
      if (!purchase) throw ApiError.notFound('Purchase not found');
      if (purchase.status !== PURCHASE_STATUSES.DRAFT) {
        throw ApiError.badRequest(`Only DRAFT purchases can be confirmed (this one is ${purchase.status})`);
      }
      if (paidAmount > purchase.grandTotal) {
        throw ApiError.badRequest(`Paid amount (${paidAmount}) cannot exceed purchase total (${purchase.grandTotal})`);
      }
      const branch = await Branch.findById(purchase.branchId).session(session);
      purchase.purchaseNo = await nextDocNo('PUR', branch?.code || 'BR', session, { model: Purchase, field: 'purchaseNo' });
      await this.post({ purchase, userId, paidAmount, paymentMode, modeDetails, session });
      await logAudit(
        { userId, action: AUDIT_ACTIONS.CONFIRM, module: 'PURCHASE', recordId: purchase._id, newValue: { status: 'COMPLETED', purchaseNo: purchase.purchaseNo }, branchId: purchase.branchId },
        session
      );
      return purchase;
    });
  }

  // ------------------------------------------------------------ payments

  static async recordPurchasePayment({ purchaseId, amount, paymentMode, modeDetails = {}, notes = '', branchId, userId }) {
    return withTransaction(async (session) => {
      const purchase = await Purchase.findById(purchaseId).session(session);
      if (!purchase) throw ApiError.notFound('Purchase not found');
      const payment = await PaymentService.recordPayment({
        referenceType: 'PURCHASE',
        referenceId: purchase._id,
        entityType: 'VENDOR',
        entityId: purchase.vendorId,
        amount,
        paymentMode,
        modeDetails,
        branchId: branchId || purchase.branchId,
        recordedBy: userId,
        notes: notes || `Payment for Purchase #${purchase.purchaseNo}`,
        purchaseDoc: purchase,
        session
      });
      return { payment, purchase };
    });
  }

  /**
   * Money the vendor hands back because we paid more than the (return-adjusted) purchase total.
   */
  static async recordVendorRefund({ purchaseId, amount, paymentMode, modeDetails = {}, notes = '', branchId, userId }) {
    return withTransaction(async (session) => {
      const purchase = await Purchase.findById(purchaseId).session(session);
      if (!purchase) throw ApiError.notFound('Purchase not found');
      await PurchaseAccounting.recompute(purchase, session, { save: false });
      if (amount > purchase.refundDue) {
        throw ApiError.badRequest(`Refund (${amount}) exceeds the amount the vendor owes on this purchase (${purchase.refundDue})`);
      }
      const payment = await PaymentService.recordPayment({
        referenceType: 'PURCHASE',
        referenceId: purchase._id,
        entityType: 'VENDOR',
        entityId: purchase.vendorId,
        amount,
        paymentMode,
        modeDetails,
        direction: 'IN',
        linkedDocType: 'PURCHASE_RETURN',
        branchId: branchId || purchase.branchId,
        recordedBy: userId,
        notes: notes || `Refund received from vendor for Purchase #${purchase.purchaseNo}`,
        internal: true,
        purchaseDoc: purchase,
        session
      });
      await logAudit(
        { userId, action: AUDIT_ACTIONS.REFUND, module: 'PURCHASE', recordId: purchase._id, newValue: { refundReceived: amount }, branchId: purchase.branchId },
        session
      );
      return { payment, purchase };
    });
  }

  // ------------------------------------------------------------ return

  static async recordPurchaseReturn({ purchaseId, items, reason, userId }) {
    if (!items || items.length === 0) throw ApiError.badRequest('At least one item must be returned');

    return withTransaction(async (session) => {
      const purchase = await Purchase.findById(purchaseId).session(session);
      if (!purchase) throw ApiError.notFound('Purchase not found');
      if (purchase.status !== PURCHASE_STATUSES.COMPLETED) {
        throw ApiError.badRequest(`Cannot return goods against a ${purchase.status} purchase`);
      }
      const branch = await Branch.findById(purchase.branchId).select('code').session(session);

      const wanted = new Map();
      for (const reqItem of items) {
        const line = purchase.items.find((l) =>
          reqItem.purchaseItemId ? l._id.toString() === reqItem.purchaseItemId.toString() : reqItem.barcode && l.barcode === reqItem.barcode.toUpperCase()
        );
        if (!line) throw ApiError.badRequest(`Item ${reqItem.purchaseItemId || reqItem.barcode} is not part of purchase ${purchase.purchaseNo}`);
        wanted.set(line._id.toString(), (wanted.get(line._id.toString()) || 0) + (reqItem.quantity || 1));
      }

      const returnItems = [];
      let totalTaxable = 0;
      let totalTax = 0;
      let totalAmount = 0;

      const returnDocId = new (require('mongoose').Types.ObjectId)();

      for (const [lineId, qty] of wanted) {
        const line = purchase.items.id(lineId);
        let value;
        try {
          value = computePurchaseReturnLine(line, qty);
        } catch (e) {
          throw ApiError.badRequest(`${line.productName} (${line.barcode}): ${e.message}`);
        }

        // stock leaves; fails cleanly if part of it was already sold
        await InventoryService.deductForPurchaseReturn({
          inventoryId: line.inventoryId,
          barcode: line.barcode,
          quantity: qty,
          returnId: returnDocId,
          performedBy: userId,
          reason: `Purchase return ${purchase.purchaseNo}: ${reason}`,
          session
        });

        line.returnedQty = (line.returnedQty || 0) + qty;
        line.returnedTaxable = DecimalUtil.add(line.returnedTaxable || 0, value.taxable);
        line.returnedTax = DecimalUtil.add(line.returnedTax || 0, value.tax);

        totalTaxable = DecimalUtil.add(totalTaxable, value.taxable);
        totalTax = DecimalUtil.add(totalTax, value.tax);
        totalAmount = DecimalUtil.add(totalAmount, value.amount);

        returnItems.push({
          purchaseItemId: line._id,
          inventoryId: line.inventoryId,
          barcode: line.barcode,
          productName: line.productName,
          metal: line.metal,
          purity: line.purity,
          grossWeight: line.grossWeight,
          netWeight: line.netWeight,
          quantity: qty,
          taxableAmount: value.taxable,
          taxAmount: value.tax,
          amount: value.amount,
          rate: line.rate
        });
      }

      // last units back -> the vendor credit equals the exact bill total (round-off included)
      if (returnStatusFor(purchase.items) === 'FULL') {
        totalAmount = Math.max(0, DecimalUtil.subtract(purchase.grandTotal, purchase.returnedAmount || 0));
      }

      purchase.returnedAmount = DecimalUtil.add(purchase.returnedAmount || 0, totalAmount);

      const returnNo = await nextDocNo('PRET', branch?.code || 'BR', session, { model: PurchaseReturn, field: 'returnNo' });

      // We owe the vendor less
      const ledger = await LedgerService.postVendorEntry({
        vendorId: purchase.vendorId,
        entryType: 'RETURN',
        referenceType: 'PurchaseReturn',
        referenceId: returnDocId,
        description: `Purchase Return #${returnNo} for Purchase #${purchase.purchaseNo}`,
        debit: totalAmount,
        branchId: purchase.branchId,
        createdBy: userId,
        session
      });

      // Re-derive paid / due / refundDue for the purchase
      await PurchaseAccounting.recompute(purchase, session);

      const purchaseReturn = new PurchaseReturn({
        _id: returnDocId,
        returnNo,
        purchaseId: purchase._id,
        purchaseNo: purchase.purchaseNo,
        vendorId: purchase.vendorId,
        returnDate: new Date(),
        items: returnItems,
        totalTaxable,
        totalTax,
        totalAmount,
        reason,
        reconciliation: {
          originalTotal: purchase.grandTotal,
          totalReturned: purchase.returnedAmount,
          adjustedTotal: purchase.adjustedTotal,
          paid: purchase.paidAmount,
          adjustedDue: purchase.dueAmount,
          refundDue: purchase.refundDue,
          vendorBalanceAfter: ledger.runningBalance
        },
        branchId: purchase.branchId,
        createdBy: userId
      });
      await purchaseReturn.save({ session });

      await logAudit(
        { userId, action: AUDIT_ACTIONS.RETURN, module: 'PURCHASE_RETURN', recordId: purchaseReturn._id, newValue: purchaseReturn.toObject(), branchId: purchase.branchId },
        session
      );
      return purchaseReturn;
    });
  }

  // ------------------------------------------------------------ cancel

  static async cancelPurchase({ purchaseId, reason, userId, paymentAction = PAYMENT_ACTIONS.CREDIT, refundMode = 'BANK_TRANSFER', refundModeDetails = {} }) {
    return withTransaction(async (session) => {
      const purchase = await Purchase.findById(purchaseId).session(session);
      if (!purchase) throw ApiError.notFound('Purchase not found');
      if (purchase.status === PURCHASE_STATUSES.CANCELLED) throw ApiError.badRequest('Purchase is already cancelled');

      if (purchase.status === PURCHASE_STATUSES.DRAFT) {
        purchase.status = PURCHASE_STATUSES.CANCELLED;
        purchase.cancellation = { reason, cancelledAt: new Date(), cancelledBy: userId, paymentAction: 'NONE' };
        await purchase.save({ session });
        return purchase;
      }

      if (purchase.returnStatus && purchase.returnStatus !== 'NONE') {
        throw ApiError.badRequest('This purchase already has returns. Return the remaining goods instead of cancelling it.');
      }

      // Stock must still be untouched
      for (const item of purchase.items) {
        const inv = await Inventory.findOne({ _id: item.inventoryId }).session(session);
        if (!inv || inv.quantity !== item.quantity || inv.status !== INVENTORY_STATUSES.AVAILABLE) {
          throw ApiError.badRequest(
            `Cannot cancel: stock for ${item.barcode} has already been sold / moved / adjusted. Use a purchase return for the remaining goods.`
          );
        }
      }
      for (const item of purchase.items) {
        await InventoryService.deductForPurchaseReturn({
          inventoryId: item.inventoryId,
          quantity: item.quantity,
          returnId: purchase._id,
          performedBy: userId,
          reason: `Purchase ${purchase.purchaseNo} cancelled: ${reason}`,
          referenceType: 'Purchase',
          movementType: STOCK_MOVEMENT_TYPES.PURCHASE_CANCEL,
          finalStatus: INVENTORY_STATUSES.CANCELLED,
          session
        });
        await Inventory.updateOne({ _id: item.inventoryId }, { $set: { isDeleted: true } }, { session });
      }

      // vendor payable reversed
      await LedgerService.postVendorEntry({
        vendorId: purchase.vendorId,
        entryType: 'CANCELLATION',
        referenceType: 'Purchase',
        referenceId: purchase._id,
        description: `Cancellation of Purchase #${purchase.purchaseNo}: ${reason}`,
        debit: purchase.grandTotal,
        branchId: purchase.branchId,
        createdBy: userId,
        session
      });

      // money already paid
      const payments = await Payment.find({ referenceType: 'PURCHASE', referenceId: purchase._id, status: 'SUCCESS' }).session(session);
      const paid = payments.filter((p) => p.direction === 'OUT').reduce((a, p) => DecimalUtil.add(a, p.amount), 0);
      const refunded = payments.filter((p) => p.direction === 'IN').reduce((a, p) => DecimalUtil.add(a, p.amount), 0);
      const netPaid = Math.max(0, DecimalUtil.subtract(paid, refunded));

      purchase.status = PURCHASE_STATUSES.CANCELLED;
      purchase.cancellation = { reason, cancelledAt: new Date(), cancelledBy: userId, paymentAction: netPaid > 0 ? paymentAction : 'NONE' };

      if (paymentAction === PAYMENT_ACTIONS.REFUND && netPaid > 0) {
        await PaymentService.recordPayment({
          referenceType: 'PURCHASE',
          referenceId: purchase._id,
          entityType: 'VENDOR',
          entityId: purchase.vendorId,
          amount: netPaid,
          paymentMode: refundMode,
          modeDetails: refundModeDetails,
          direction: 'IN',
          linkedDocType: 'PURCHASE_CANCELLATION',
          linkedDocId: purchase._id,
          branchId: purchase.branchId,
          recordedBy: userId,
          notes: `Refund from vendor on cancellation of ${purchase.purchaseNo}`,
          internal: true,
          purchaseDoc: purchase,
          session
        });
      } else {
        await PurchaseAccounting.recompute(purchase, session);
      }

      if (purchase.purchaseOrderId) {
        const PurchaseOrderService = require('./purchaseOrder.service');
        await PurchaseOrderService.reverseReceipt({ purchase, userId, session });
      }

      await logAudit(
        { userId, action: AUDIT_ACTIONS.CANCEL, module: 'PURCHASE', recordId: purchase._id, newValue: { status: 'CANCELLED', reason, paymentAction }, branchId: purchase.branchId },
        session
      );
      return purchase;
    });
  }
}

module.exports = PurchaseService;
