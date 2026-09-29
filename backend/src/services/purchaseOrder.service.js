const PurchaseOrder = require('../models/PurchaseOrder');
const Vendor = require('../models/Vendor');
const Branch = require('../models/Branch');
const Purchase = require('../models/Purchase');
const PurchaseService = require('./purchase.service');
const DecimalUtil = require('../utils/decimal');
const ApiError = require('../utils/apiError');
const { withTransaction } = require('../utils/transaction');
const { logAudit } = require('../utils/auditLogger');
const { nextDocNo } = require('../utils/sequence');
const { PURCHASE_ORDER_STATUSES: S, AUDIT_ACTIONS } = require('../config/constants');

/**
 * Purchase Order workflow
 *
 *   DRAFT ─submit─> SUBMITTED ─approve─> APPROVED ─order─> ORDERED ─receive─> PARTIALLY_RECEIVED ─receive─> RECEIVED ─close─> CLOSED
 *                       │                                                                    └─────────────close (short close)────────┘
 *                       └─reject─> REJECTED ─(edit)─> DRAFT
 *   DRAFT / SUBMITTED / APPROVED / ORDERED / REJECTED ──cancel──> CANCELLED   (only while nothing has been received)
 *
 * Every receipt (partial or complete) creates a real Purchase (goods-receipt + vendor bill): stock is added,
 * the vendor ledger is credited and optional payment is recorded by the normal purchase logic.
 */
class PurchaseOrderService {
  // ---------------------------------------------------------------- helpers

  static buildItems(items) {
    return items.map((i) => {
      const grossWeight = DecimalUtil.roundWeight(i.grossWeight);
      const stoneWeight = DecimalUtil.roundWeight(i.stoneWeight || 0);
      if (grossWeight < stoneWeight) {
        throw ApiError.badRequest(`${i.productName}: gross weight cannot be less than stone weight`);
      }
      const netWeight = DecimalUtil.roundWeight(grossWeight - stoneWeight);
      const quantity = parseInt(i.quantity, 10);
      const metal = DecimalUtil.multiply(DecimalUtil.multiply(netWeight, quantity, 3), i.rate);
      const estimatedAmount = DecimalUtil.add(metal, i.makingAmount || 0, i.otherCharges || 0);
      return {
        productId: i.productId,
        categoryId: i.categoryId,
        productName: i.productName,
        metal: i.metal,
        purity: i.purity,
        grossWeight,
        stoneWeight,
        netWeight,
        quantity,
        receivedQty: 0,
        rate: i.rate,
        makingAmount: i.makingAmount || 0,
        otherCharges: i.otherCharges || 0,
        gstRate: i.gstRate || 0,
        estimatedAmount
      };
    });
  }

  static totals(items) {
    const estimatedSubtotal = items.reduce((a, i) => DecimalUtil.add(a, i.estimatedAmount), 0);
    const estimatedTax = items.reduce((a, i) => DecimalUtil.add(a, DecimalUtil.percentage(i.estimatedAmount, i.gstRate || 0)), 0);
    return { estimatedSubtotal, estimatedTax, estimatedTotal: DecimalUtil.add(estimatedSubtotal, estimatedTax) };
  }

  static push(po, status, userId, note = '') {
    po.status = status;
    po.statusHistory.push({ status, at: new Date(), by: userId, note });
  }

  static async load(id, session) {
    const po = await PurchaseOrder.findById(id).session(session);
    if (!po) throw ApiError.notFound('Purchase order not found');
    return po;
  }

  static assertStatus(po, allowed, action) {
    if (!allowed.includes(po.status)) {
      throw ApiError.badRequest(`Cannot ${action} a purchase order in ${po.status} state (allowed from: ${allowed.join(', ')})`);
    }
  }

  static async audit(po, userId, action, extra = {}, session) {
    await logAudit(
      { userId, action, module: 'PURCHASE_ORDER', recordId: po._id, newValue: { status: po.status, ...extra }, branchId: po.branchId },
      session
    );
  }

  // ---------------------------------------------------------------- lifecycle

  static async create({ vendorId, branchId, expectedDeliveryDate, items, notes = '', userId }) {
    return withTransaction(async (session) => {
      const vendor = await Vendor.findById(vendorId).session(session);
      if (!vendor) throw ApiError.notFound('Vendor not found');
      const branch = await Branch.findById(branchId).session(session);
      if (!branch) throw ApiError.notFound('Branch not found');

      const built = this.buildItems(items);
      const poNo = await nextDocNo('PO', branch.code || 'BR', session, { model: PurchaseOrder, field: 'poNo' });

      const po = new PurchaseOrder({
        poNo,
        vendorId,
        branchId,
        poDate: new Date(),
        expectedDeliveryDate,
        items: built,
        ...this.totals(built),
        status: S.DRAFT,
        statusHistory: [{ status: S.DRAFT, at: new Date(), by: userId, note: 'Created' }],
        createdBy: userId,
        notes
      });
      await po.save({ session });
      await this.audit(po, userId, AUDIT_ACTIONS.CREATE, {}, session);
      return po;
    });
  }

  static async update({ id, vendorId, expectedDeliveryDate, items, notes, userId }) {
    return withTransaction(async (session) => {
      const po = await this.load(id, session);
      this.assertStatus(po, [S.DRAFT, S.REJECTED], 'edit');

      if (vendorId) {
        const vendor = await Vendor.findById(vendorId).session(session);
        if (!vendor) throw ApiError.notFound('Vendor not found');
        po.vendorId = vendorId;
      }
      if (expectedDeliveryDate) po.expectedDeliveryDate = expectedDeliveryDate;
      if (notes !== undefined) po.notes = notes;
      if (items) {
        po.items = this.buildItems(items);
        Object.assign(po, this.totals(po.items));
      }
      if (po.status === S.REJECTED) this.push(po, S.DRAFT, userId, 'Edited after rejection');
      await po.save({ session });
      await this.audit(po, userId, AUDIT_ACTIONS.UPDATE, {}, session);
      return po;
    });
  }

  static async submit({ id, userId }) {
    return withTransaction(async (session) => {
      const po = await this.load(id, session);
      this.assertStatus(po, [S.DRAFT], 'submit');
      if (!po.items.length) throw ApiError.badRequest('A purchase order needs at least one item');
      po.submittedAt = new Date();
      this.push(po, S.SUBMITTED, userId);
      await po.save({ session });
      await this.audit(po, userId, AUDIT_ACTIONS.SUBMIT, {}, session);
      return po;
    });
  }

  static async approve({ id, userId, note = '' }) {
    return withTransaction(async (session) => {
      const po = await this.load(id, session);
      this.assertStatus(po, [S.SUBMITTED], 'approve');
      po.approvedAt = new Date();
      po.approvedBy = userId;
      this.push(po, S.APPROVED, userId, note);
      await po.save({ session });
      await this.audit(po, userId, AUDIT_ACTIONS.APPROVE, {}, session);
      return po;
    });
  }

  static async reject({ id, userId, reason }) {
    return withTransaction(async (session) => {
      const po = await this.load(id, session);
      this.assertStatus(po, [S.SUBMITTED], 'reject');
      po.rejectionReason = reason;
      this.push(po, S.REJECTED, userId, reason);
      await po.save({ session });
      await this.audit(po, userId, AUDIT_ACTIONS.REJECT, { reason }, session);
      return po;
    });
  }

  /** APPROVED -> ORDERED : the order has been sent to the vendor */
  static async markOrdered({ id, userId, note = '' }) {
    return withTransaction(async (session) => {
      const po = await this.load(id, session);
      this.assertStatus(po, [S.APPROVED], 'place');
      po.orderedAt = new Date();
      this.push(po, S.ORDERED, userId, note);
      await po.save({ session });
      await this.audit(po, userId, AUDIT_ACTIONS.ORDER, {}, session);
      return po;
    });
  }

  static async cancel({ id, userId, reason }) {
    return withTransaction(async (session) => {
      const po = await this.load(id, session);
      this.assertStatus(po, [S.DRAFT, S.SUBMITTED, S.REJECTED, S.APPROVED, S.ORDERED], 'cancel');
      if (po.receipts.length > 0) {
        throw ApiError.badRequest('Goods have already been received against this order. Close it instead of cancelling.');
      }
      po.cancellationReason = reason;
      this.push(po, S.CANCELLED, userId, reason);
      await po.save({ session });
      await this.audit(po, userId, AUDIT_ACTIONS.CANCEL, { reason }, session);
      return po;
    });
  }

  /**
   * Close a received / partially received order. Closing with pending quantity is a "short close":
   * a reason is mandatory and the outstanding quantity is abandoned.
   */
  static async close({ id, userId, reason = '' }) {
    return withTransaction(async (session) => {
      const po = await this.load(id, session);
      this.assertStatus(po, [S.RECEIVED, S.PARTIALLY_RECEIVED], 'close');
      const pending = po.items.some((i) => i.receivedQty < i.quantity);
      if (pending && !reason) {
        throw ApiError.badRequest('This order still has undelivered quantity. Give a reason to short-close it.');
      }
      po.closedAt = new Date();
      po.closeReason = reason;
      this.push(po, S.CLOSED, userId, reason);
      await po.save({ session });
      await this.audit(po, userId, AUDIT_ACTIONS.CLOSE, { reason, shortClosed: pending }, session);
      return po;
    });
  }

  // ---------------------------------------------------------------- receiving

  /**
   * Receive goods (partial or complete). Creates the Purchase, adds stock, credits the vendor ledger
   * and, if paidAmount is given, records the payment.
   */
  static async receive({ id, items, vendorInvoiceNo = '', purchaseDate, paidAmount = 0, paymentMode = 'BANK_TRANSFER', modeDetails = {}, notes = '', userId }) {
    if (!items || items.length === 0) throw ApiError.badRequest('Nothing to receive');

    return withTransaction(async (session) => {
      const po = await this.load(id, session);
      this.assertStatus(po, [S.ORDERED, S.PARTIALLY_RECEIVED], 'receive goods against');

      const purchaseItems = [];
      for (const r of items) {
        const line = po.items.id(r.poItemId);
        if (!line) throw ApiError.badRequest(`Item ${r.poItemId} is not on purchase order ${po.poNo}`);
        const pending = line.quantity - line.receivedQty;
        if (r.quantity > pending) {
          throw ApiError.badRequest(`${line.productName}: receiving ${r.quantity} but only ${pending} is still pending`);
        }
        const share = r.quantity / line.quantity;

        purchaseItems.push({
          purchaseOrderItemId: line._id,
          productId: line.productId,
          categoryId: line.categoryId,
          productName: line.productName,
          barcode: r.barcode,
          metal: line.metal,
          purity: line.purity,
          grossWeight: r.grossWeight !== undefined ? r.grossWeight : line.grossWeight,
          stoneWeight: r.stoneWeight !== undefined ? r.stoneWeight : line.stoneWeight,
          quantity: r.quantity,
          rate: r.rate !== undefined ? r.rate : line.rate,
          makingAmount: r.makingAmount !== undefined ? r.makingAmount : DecimalUtil.roundCurrency(line.makingAmount * share),
          otherCharges: r.otherCharges !== undefined ? r.otherCharges : DecimalUtil.roundCurrency(line.otherCharges * share),
          gstRate: r.gstRate !== undefined ? r.gstRate : line.gstRate
        });
        line.receivedQty += r.quantity;
      }

      const purchase = await PurchaseService.recordPurchase({
        vendorId: po.vendorId,
        vendorInvoiceNo,
        branchId: po.branchId,
        purchaseDate: purchaseDate || new Date(),
        items: purchaseItems,
        paidAmount,
        paymentMode,
        modeDetails,
        notes: notes || `Received against ${po.poNo}`,
        userId,
        purchaseOrderId: po._id,
        session
      });

      po.receipts.push({ purchaseId: purchase._id, purchaseNo: purchase.purchaseNo, receivedAt: new Date(), receivedBy: userId });
      const complete = po.items.every((i) => i.receivedQty >= i.quantity);
      this.push(po, complete ? S.RECEIVED : S.PARTIALLY_RECEIVED, userId, `Received via ${purchase.purchaseNo}`);
      await po.save({ session });
      await this.audit(po, userId, AUDIT_ACTIONS.RECEIVE, { purchaseNo: purchase.purchaseNo, complete }, session);

      return { purchaseOrder: po, purchase };
    });
  }

  /**
   * A purchase created from this PO was cancelled - give its quantities back to the order.
   */
  static async reverseReceipt({ purchase, userId, session }) {
    const po = await PurchaseOrder.findById(purchase.purchaseOrderId).session(session);
    if (!po) return null;

    for (const item of purchase.items) {
      const line = item.purchaseOrderItemId ? po.items.id(item.purchaseOrderItemId) : null;
      if (line) line.receivedQty = Math.max(0, line.receivedQty - item.quantity);
    }
    po.receipts = po.receipts.filter((r) => r.purchaseId.toString() !== purchase._id.toString());

    if (po.status !== S.CLOSED) {
      const anyReceived = po.items.some((i) => i.receivedQty > 0);
      const complete = po.items.every((i) => i.receivedQty >= i.quantity);
      const next = complete ? S.RECEIVED : anyReceived ? S.PARTIALLY_RECEIVED : S.ORDERED;
      if (next !== po.status) this.push(po, next, userId, `Receipt ${purchase.purchaseNo} cancelled`);
    }
    await po.save({ session });
    return po;
  }

  static async getWithProgress(id) {
    const po = await PurchaseOrder.findById(id)
      .populate('vendorId', 'name company mobile')
      .populate('branchId', 'name code')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name');
    if (!po) throw ApiError.notFound('Purchase order not found');
    const purchases = await Purchase.find({ purchaseOrderId: po._id }).select('purchaseNo grandTotal paymentStatus status purchaseDate');
    const data = po.toObject();
    data.items = data.items.map((i) => ({ ...i, pendingQty: i.quantity - i.receivedQty }));
    data.purchases = purchases;
    return data;
  }
}

module.exports = PurchaseOrderService;
