const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const Payment = require('../models/Payment');
const Exchange = require('../models/Exchange');
const Inventory = require('../models/Inventory');
const CalculationService = require('./calculation.service');
const InventoryService = require('./inventory.service');
const LedgerService = require('./ledger.service');
const PaymentService = require('./payment.service');
const InvoiceAccounting = require('./invoiceAccounting.service');
const { withTransaction } = require('../utils/transaction');
const { logAudit } = require('../utils/auditLogger');
const { nextDocNo } = require('../utils/sequence');
const ApiError = require('../utils/apiError');
const DecimalUtil = require('../utils/decimal');
const {
  BILL_TYPES,
  INVOICE_STATUSES,
  LIVE_INVOICE_STATUSES,
  PAYMENT_ACTIONS,
  AUDIT_ACTIONS
} = require('../config/constants');

/**
 * Billing lifecycle
 *
 *   KACHA / PAKKA   DRAFT ──confirm──> CONFIRMED ──> (payments, returns) ──> CANCELLED
 *                                          │
 *   KACHA only                             └──convert──> CONVERTED   (a new PAKKA invoice takes over)
 *
 *  DRAFT      : nothing is posted - no stock, no ledger, no payments. Gets a DRF/... number.
 *  CONFIRMED  : stock deducted, customer ledger debited, real invoice number allocated, payments allowed.
 *  CONVERTED  : the Kacha bill is closed; GST difference is posted to the ledger, payments / old-gold
 *               adjustments move to the Pakka invoice, stock is NOT touched again.
 *  CANCELLED  : stock restored, receivable reversed, money already received is refunded or kept as credit.
 */
class BillingService {
  // ----------------------------------------------------------------- helpers

  static customerSnapshot(customer) {
    return {
      name: customer.name,
      mobile: customer.mobile,
      address: `${customer.address?.street || ''} ${customer.address?.city || ''}`.trim(),
      gstin: customer.gstin || '',
      state: customer.address?.state || '',
      stateCode: customer.address?.stateCode || '07'
    };
  }

  static async realInvoiceNo(billType, branch, session) {
    const prefix = billType === BILL_TYPES.KACHA ? 'KACHA' : 'INV';
    return nextDocNo(prefix, branch.code || 'BR', session, { model: Invoice, field: 'invoiceNo' });
  }

  static async draftInvoiceNo(branch, session) {
    return nextDocNo('DRF', branch.code || 'BR', session, { model: Invoice, field: 'invoiceNo' });
  }

  /**
   * Turn client line items into authoritative lines: weights, metal, purity, cost and the exact
   * inventory row come from the stock record, never from the request.
   */
  static async resolveItems({ items, branchId, session, requireStock }) {
    if (!items || items.length === 0) {
      throw ApiError.badRequest('Invoice must contain at least one item');
    }

    const resolved = [];
    for (const raw of items) {
      const quantity = parseInt(raw.quantity || 1, 10);
      const inv = await InventoryService.resolveSellable({
        barcode: raw.barcode,
        productId: raw.productId,
        branchId,
        quantity,
        session,
        requireStock
      });

      resolved.push({
        ...raw,
        productId: inv.productId,
        inventoryId: inv._id,
        barcode: inv.barcode,
        metal: inv.metal,
        purity: inv.purity,
        grossWeight: inv.grossWeight,
        stoneWeight: inv.stoneWeight,
        netWeight: inv.netWeight,
        quantity,
        unitCost: inv.costPrice || 0
      });
    }
    return resolved;
  }

  static calculate({ resolved, billType, branch, customer, discount }) {
    const calc = CalculationService.calculateInvoiceTotals({
      items: resolved,
      billType,
      branchStateCode: branch.address?.stateCode || '07',
      customerStateCode: customer.address?.stateCode || '07',
      extraDiscount: discount
    });
    calc.items.forEach((line) => {
      line.costAmount = DecimalUtil.roundCurrency((line.unitCost || 0) * line.quantity);
    });
    return calc;
  }

  /**
   * Everything that happens when an invoice becomes real: stock out + receivable in.
   */
  static async postConfirmed(invoice, userId, session) {
    for (const item of invoice.items) {
      await InventoryService.deductItemForSale({
        inventoryId: item.inventoryId,
        barcode: item.barcode,
        productId: item.productId,
        branchId: invoice.branchId,
        quantity: item.quantity || 1,
        invoiceId: invoice._id,
        performedBy: userId,
        session
      });
    }

    await LedgerService.postCustomerEntry({
      customerId: invoice.customerId,
      entryType: 'SALE',
      referenceType: 'Invoice',
      referenceId: invoice._id,
      description: `${invoice.billType === BILL_TYPES.KACHA ? 'Kacha Bill' : 'GST Invoice'} #${invoice.invoiceNo}`,
      debit: invoice.grandTotal,
      branchId: invoice.branchId,
      createdBy: userId,
      session
    });
  }

  static async applyCheckoutPayments({ invoice, payments, userId, session }) {
    for (const p of payments || []) {
      if (!(p.amount > 0)) continue;
      await PaymentService.recordPayment({
        referenceType: 'INVOICE',
        referenceId: invoice._id,
        entityType: 'CUSTOMER',
        entityId: invoice.customerId,
        amount: p.amount,
        paymentMode: p.paymentMode,
        modeDetails: p.modeDetails || {},
        branchId: invoice.branchId,
        recordedBy: userId,
        notes: `Checkout payment for ${invoice.invoiceNo}`,
        invoiceDoc: invoice,
        session
      });
    }
  }

  // ----------------------------------------------------------------- create

  static async createInvoice(billType, {
    customerId,
    branchId,
    items,
    discount = 0,
    payments = [],
    notes = '',
    userId,
    status = INVOICE_STATUSES.CONFIRMED
  }) {
    if (![INVOICE_STATUSES.DRAFT, INVOICE_STATUSES.CONFIRMED].includes(status)) {
      throw ApiError.badRequest('A new invoice can only be created as DRAFT or CONFIRMED');
    }
    if (status === INVOICE_STATUSES.DRAFT && payments && payments.length > 0) {
      throw ApiError.badRequest('Payments cannot be taken on a DRAFT bill. Confirm the bill first.');
    }

    return withTransaction(async (session) => {
      const customer = await Customer.findById(customerId).session(session);
      if (!customer) throw ApiError.notFound('Customer not found');
      const branch = await Branch.findById(branchId).session(session);
      if (!branch) throw ApiError.notFound('Branch not found');

      const isConfirmed = status === INVOICE_STATUSES.CONFIRMED;
      const resolved = await this.resolveItems({ items, branchId, session, requireStock: isConfirmed });
      const calc = this.calculate({ resolved, billType, branch, customer, discount });

      const invoiceNo = isConfirmed
        ? await this.realInvoiceNo(billType, branch, session)
        : await this.draftInvoiceNo(branch, session);

      const invoice = new Invoice({
        invoiceNo,
        billType,
        invoiceDate: new Date(),
        customerId: customer._id,
        customerSnapshot: this.customerSnapshot(customer),
        branchId,
        createdBy: userId,
        items: calc.items,
        subtotal: calc.subtotal,
        extraDiscount: calc.extraDiscount,
        discount: calc.discount,
        taxableAmount: calc.taxableAmount,
        tax: calc.tax,
        roundOff: calc.roundOff,
        grandTotal: calc.grandTotal,
        paymentSummary: { paid: 0, due: calc.grandTotal, exchangeAdjusted: 0, refunded: 0, netPayable: calc.grandTotal, excessReceived: 0 },
        status,
        paymentStatus: 'PENDING',
        confirmedAt: isConfirmed ? new Date() : undefined,
        notes
      });
      await invoice.save({ session });

      if (isConfirmed) {
        await this.postConfirmed(invoice, userId, session);
        await this.applyCheckoutPayments({ invoice, payments, userId, session });
      }

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.CREATE,
          module: 'INVOICE',
          recordId: invoice._id,
          newValue: invoice.toObject(),
          branchId
        },
        session
      );

      return invoice;
    });
  }

  static createKachaBill(params) {
    return this.createInvoice(BILL_TYPES.KACHA, params);
  }

  static createPakkaBill(params) {
    return this.createInvoice(BILL_TYPES.PAKKA, params);
  }

  // ----------------------------------------------------------------- draft handling

  static async updateDraft({ invoiceId, items, discount, customerId, notes, userId }) {
    return withTransaction(async (session) => {
      const invoice = await Invoice.findById(invoiceId).session(session);
      if (!invoice) throw ApiError.notFound('Bill not found');
      if (invoice.status !== INVOICE_STATUSES.DRAFT) {
        throw ApiError.badRequest(`Only DRAFT bills can be edited (this bill is ${invoice.status})`);
      }

      const before = invoice.toObject();
      const customer = await Customer.findById(customerId || invoice.customerId).session(session);
      if (!customer) throw ApiError.notFound('Customer not found');
      const branch = await Branch.findById(invoice.branchId).session(session);

      const resolved = await this.resolveItems({
        items: items || invoice.items.map((i) => ({ ...i.toObject(), _id: undefined })),
        branchId: invoice.branchId,
        session,
        requireStock: false
      });
      const calc = this.calculate({
        resolved,
        billType: invoice.billType,
        branch,
        customer,
        discount: discount !== undefined ? discount : invoice.extraDiscount || 0
      });

      invoice.customerId = customer._id;
      invoice.customerSnapshot = this.customerSnapshot(customer);
      invoice.items = calc.items;
      invoice.subtotal = calc.subtotal;
      invoice.extraDiscount = calc.extraDiscount;
      invoice.discount = calc.discount;
      invoice.taxableAmount = calc.taxableAmount;
      invoice.tax = calc.tax;
      invoice.roundOff = calc.roundOff;
      invoice.grandTotal = calc.grandTotal;
      invoice.paymentSummary = { paid: 0, due: calc.grandTotal, exchangeAdjusted: 0, refunded: 0, netPayable: calc.grandTotal, excessReceived: 0 };
      if (notes !== undefined) invoice.notes = notes;
      await invoice.save({ session });

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.UPDATE,
          module: 'INVOICE',
          recordId: invoice._id,
          oldValue: { grandTotal: before.grandTotal, items: before.items.length },
          newValue: { grandTotal: invoice.grandTotal, items: invoice.items.length },
          branchId: invoice.branchId
        },
        session
      );
      return invoice;
    });
  }

  static async confirmDraft({ invoiceId, payments = [], userId }) {
    return withTransaction(async (session) => {
      const invoice = await Invoice.findById(invoiceId).session(session);
      if (!invoice) throw ApiError.notFound('Bill not found');
      if (invoice.status !== INVOICE_STATUSES.DRAFT) {
        throw ApiError.badRequest(`Only DRAFT bills can be confirmed (this bill is ${invoice.status})`);
      }

      const branch = await Branch.findById(invoice.branchId).session(session);
      const customer = await Customer.findById(invoice.customerId).session(session);
      if (!customer) throw ApiError.notFound('Customer not found');

      // Re-price against current stock and current customer state before committing
      const resolved = await this.resolveItems({
        items: invoice.items.map((i) => ({ ...i.toObject(), _id: undefined })),
        branchId: invoice.branchId,
        session,
        requireStock: true
      });
      const calc = this.calculate({
        resolved,
        billType: invoice.billType,
        branch,
        customer,
        discount: invoice.extraDiscount || 0
      });

      invoice.customerSnapshot = this.customerSnapshot(customer);
      invoice.items = calc.items;
      invoice.subtotal = calc.subtotal;
      invoice.discount = calc.discount;
      invoice.taxableAmount = calc.taxableAmount;
      invoice.tax = calc.tax;
      invoice.roundOff = calc.roundOff;
      invoice.grandTotal = calc.grandTotal;
      invoice.paymentSummary = { paid: 0, due: calc.grandTotal, exchangeAdjusted: 0, refunded: 0, netPayable: calc.grandTotal, excessReceived: 0 };
      invoice.invoiceNo = await this.realInvoiceNo(invoice.billType, branch, session);
      invoice.invoiceDate = new Date();
      invoice.status = INVOICE_STATUSES.CONFIRMED;
      invoice.confirmedAt = new Date();
      await invoice.save({ session });

      await this.postConfirmed(invoice, userId, session);
      await this.applyCheckoutPayments({ invoice, payments, userId, session });

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.CONFIRM,
          module: 'INVOICE',
          recordId: invoice._id,
          oldValue: { status: INVOICE_STATUSES.DRAFT },
          newValue: { status: INVOICE_STATUSES.CONFIRMED, invoiceNo: invoice.invoiceNo },
          branchId: invoice.branchId
        },
        session
      );
      return invoice;
    });
  }

  // ----------------------------------------------------------------- Kacha -> Pakka

  static async convertKachaToPakka({ kachaBillId, userId }) {
    return withTransaction(async (session) => {
      const kacha = await Invoice.findById(kachaBillId).session(session);
      if (!kacha) throw ApiError.notFound('Kacha bill not found');

      if (kacha.billType !== BILL_TYPES.KACHA) {
        throw ApiError.badRequest('Only KACHA bills can be converted to PAKKA bills');
      }
      if (kacha.status === INVOICE_STATUSES.CONVERTED) {
        throw ApiError.badRequest(`This Kacha bill has already been converted to Pakka Bill (Ref: ${kacha.convertedToPakkaBillId})`);
      }
      if (kacha.status === INVOICE_STATUSES.CANCELLED) {
        throw ApiError.badRequest('Cannot convert a CANCELLED Kacha bill');
      }
      if (kacha.status === INVOICE_STATUSES.DRAFT) {
        throw ApiError.badRequest('This Kacha bill is still a DRAFT. Confirm it first (stock + ledger are posted on confirmation), then convert.');
      }
      if (!LIVE_INVOICE_STATUSES.includes(kacha.status)) {
        throw ApiError.badRequest(`Kacha bill in ${kacha.status} state cannot be converted`);
      }
      if (kacha.returnStatus && kacha.returnStatus !== 'NONE') {
        throw ApiError.badRequest('This Kacha bill already has sales returns. Converting it would misstate GST - create a fresh Pakka invoice for the remaining items instead.');
      }

      const branch = await Branch.findById(kacha.branchId).session(session);
      const customer = await Customer.findById(kacha.customerId).session(session);
      if (!customer) throw ApiError.notFound('Customer not found');

      // Invoice-level discount only. kacha.discount also contains the item discounts, which the
      // calculation adds again from the items - passing it as-is would double count them.
      const itemDiscountSum = kacha.items.reduce((a, i) => DecimalUtil.add(a, i.discount || 0), 0);
      const extraDiscount = Math.max(0, DecimalUtil.subtract(kacha.discount, itemDiscountSum));

      const calc = CalculationService.calculateInvoiceTotals({
        items: kacha.items.map((i) => {
          const o = i.toObject();
          delete o._id;
          return o;
        }),
        billType: BILL_TYPES.PAKKA,
        branchStateCode: branch.address?.stateCode || '07',
        customerStateCode: customer.address?.stateCode || kacha.customerSnapshot?.stateCode || '07',
        extraDiscount
      });
      calc.items.forEach((line) => {
        line.costAmount = DecimalUtil.roundCurrency((line.unitCost || 0) * line.quantity);
      });

      const pakkaNo = await this.realInvoiceNo(BILL_TYPES.PAKKA, branch, session);

      const pakka = new Invoice({
        invoiceNo: pakkaNo,
        billType: BILL_TYPES.PAKKA,
        invoiceDate: new Date(),
        customerId: kacha.customerId,
        customerSnapshot: this.customerSnapshot(customer),
        branchId: kacha.branchId,
        createdBy: userId,
        items: calc.items,
        subtotal: calc.subtotal,
        extraDiscount: calc.extraDiscount,
        discount: calc.discount,
        taxableAmount: calc.taxableAmount,
        tax: calc.tax,
        roundOff: calc.roundOff,
        grandTotal: calc.grandTotal,
        paymentSummary: { paid: 0, due: calc.grandTotal, exchangeAdjusted: 0, refunded: 0, netPayable: calc.grandTotal, excessReceived: 0 },
        status: INVOICE_STATUSES.CONFIRMED,
        paymentStatus: 'PENDING',
        confirmedAt: new Date(),
        convertedFromKachaBillId: kacha._id,
        notes: `Converted from Kacha Bill #${kacha.invoiceNo}. ${kacha.notes || ''}`.trim()
      });
      await pakka.save({ session });

      // 1. Everything that was received against the Kacha bill now belongs to the Pakka invoice
      await Payment.updateMany(
        { referenceType: 'INVOICE', referenceId: kacha._id },
        { $set: { referenceId: pakka._id, transferredFromId: kacha._id } },
        { session }
      );

      // 2. Old-gold exchanges that were adjusted against the Kacha bill follow it
      const exchanges = await Exchange.find({ 'adjustments.invoiceId': kacha._id }).session(session);
      for (const ex of exchanges) {
        ex.adjustments.forEach((a) => {
          if (a.invoiceId && a.invoiceId.toString() === kacha._id.toString()) a.invoiceId = pakka._id;
        });
        if (ex.invoiceId && ex.invoiceId.toString() === kacha._id.toString()) ex.invoiceId = pakka._id;
        await ex.save({ session });
      }

      // 3. Stock is already out - just keep the "last sold on" pointer truthful
      await Inventory.updateMany({ lastSoldInvoiceId: kacha._id }, { $set: { lastSoldInvoiceId: pakka._id } }, { session });

      // 4. Ledger: the Kacha debit stays; post only the difference (normally the GST)
      const difference = DecimalUtil.subtract(pakka.grandTotal, kacha.grandTotal);
      if (difference !== 0) {
        await LedgerService.postCustomerEntry({
          customerId: kacha.customerId,
          entryType: 'ADJUSTMENT',
          referenceType: 'Invoice',
          referenceId: pakka._id,
          description: `GST differential on conversion Kacha ${kacha.invoiceNo} -> Pakka ${pakka.invoiceNo}`,
          debit: difference > 0 ? difference : 0,
          credit: difference < 0 ? Math.abs(difference) : 0,
          branchId: kacha.branchId,
          createdBy: userId,
          session
        });
      }

      // 5. Payment position of the Pakka invoice, re-derived from the payments that moved over
      await InvoiceAccounting.recompute(pakka, session);

      // 6. Close the Kacha bill
      kacha.status = INVOICE_STATUSES.CONVERTED;
      kacha.convertedToPakkaBillId = pakka._id;
      kacha.convertedAt = new Date();
      kacha.paymentSummary.due = 0;
      await kacha.save({ session });

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.CONVERT,
          module: 'INVOICE',
          recordId: kacha._id,
          oldValue: { status: INVOICE_STATUSES.CONFIRMED, grandTotal: kacha.grandTotal },
          newValue: {
            status: INVOICE_STATUSES.CONVERTED,
            convertedToPakkaBillId: pakka._id,
            pakkaInvoiceNo: pakka.invoiceNo,
            pakkaGrandTotal: pakka.grandTotal,
            gstDifferencePosted: difference
          },
          branchId: kacha.branchId
        },
        session
      );

      return pakka;
    });
  }

  // ----------------------------------------------------------------- cancel

  /**
   * Cancel an invoice completely.
   *
   *  1. remaining stock goes back to inventory (units already returned by the customer are not restored twice)
   *  2. the still-open receivable is reversed on the customer ledger
   *  3. old-gold adjustments used on this bill go back to the customer as credit (exchange -> PENDING_ADJUSTMENT)
   *  4. money the customer already paid is handled EXPLICITLY:
   *        paymentAction = REFUND  -> cash / UPI / bank refund is paid out and recorded (Payment direction OUT)
   *        paymentAction = CREDIT  -> stays on the customer ledger as credit (default, no cash leaves the shop)
   */
  static async cancelInvoice({
    invoiceId,
    reason,
    userId,
    paymentAction = PAYMENT_ACTIONS.CREDIT,
    refundMode = 'CASH',
    refundModeDetails = {}
  }) {
    return withTransaction(async (session) => {
      const invoice = await Invoice.findById(invoiceId).session(session);
      if (!invoice) throw ApiError.notFound('Invoice not found');

      if (invoice.status === INVOICE_STATUSES.CANCELLED) {
        throw ApiError.badRequest('Invoice is already cancelled');
      }
      if (invoice.status === INVOICE_STATUSES.CONVERTED) {
        throw ApiError.badRequest(
          `This Kacha bill was converted to Pakka invoice ${invoice.convertedToPakkaBillId}. Cancel the Pakka invoice instead.`
        );
      }

      // Draft: nothing was ever posted
      if (invoice.status === INVOICE_STATUSES.DRAFT) {
        invoice.status = INVOICE_STATUSES.CANCELLED;
        invoice.cancellationReason = reason;
        invoice.cancelledAt = new Date();
        invoice.cancelledBy = userId;
        invoice.cancellationSummary = { paymentAction: 'NONE', receivableReversed: 0, cashRefunded: 0, creditRetained: 0 };
        await invoice.save({ session });
        await logAudit(
          { userId, action: AUDIT_ACTIONS.CANCEL, module: 'INVOICE', recordId: invoice._id, newValue: { status: 'CANCELLED', reason }, branchId: invoice.branchId },
          session
        );
        return invoice;
      }

      // 1. stock
      for (const item of invoice.items) {
        const remaining = (item.quantity || 0) - (item.returnedQty || 0);
        if (remaining > 0) {
          await InventoryService.restoreItemStock({
            inventoryId: item.inventoryId,
            barcode: item.barcode,
            quantity: remaining,
            referenceType: 'Invoice',
            referenceId: invoice._id,
            performedBy: userId,
            reason: `Invoice ${invoice.invoiceNo} cancelled: ${reason}`,
            session
          });
        }
      }

      // 2. receivable (whatever a sales return has not already credited)
      const receivableReversed = Math.max(0, DecimalUtil.subtract(invoice.grandTotal, invoice.returnedAmount || 0));
      if (receivableReversed > 0) {
        await LedgerService.postCustomerEntry({
          customerId: invoice.customerId,
          entryType: 'CANCELLATION',
          referenceType: 'Invoice',
          referenceId: invoice._id,
          description: `Cancellation of Invoice #${invoice.invoiceNo}: ${reason}`,
          credit: receivableReversed,
          branchId: invoice.branchId,
          createdBy: userId,
          session
        });
      }

      // 3. old-gold used on this bill becomes customer credit again
      const payments = await Payment.find({ referenceType: 'INVOICE', referenceId: invoice._id, status: 'SUCCESS' }).session(session);
      const exchangeAdjustments = payments.filter((p) => p.paymentMode === 'EXCHANGE' && p.direction === 'IN');
      const exchanges = await Exchange.find({ 'adjustments.invoiceId': invoice._id }).session(session);
      for (const ex of exchanges) {
        const mine = ex.adjustments.filter((a) => a.invoiceId && a.invoiceId.toString() === invoice._id.toString());
        const releasing = mine.reduce((a, m) => DecimalUtil.add(a, m.amount), 0);
        ex.adjustments = ex.adjustments.filter((a) => !(a.invoiceId && a.invoiceId.toString() === invoice._id.toString()));
        ex.adjustedAmount = Math.max(0, DecimalUtil.subtract(ex.adjustedAmount, releasing));
        ex.invoiceId = ex.adjustments.length ? ex.adjustments[0].invoiceId : undefined;
        ex.status = ex.paidOutAmount > 0 && ex.adjustedAmount + ex.paidOutAmount >= ex.totalExchangeValue
          ? 'PAID_OUT'
          : ex.adjustedAmount > 0
          ? 'PARTIALLY_ADJUSTED'
          : 'PENDING_ADJUSTMENT';
        await ex.save({ session });
      }
      for (const p of exchangeAdjustments) {
        // these adjustments never touched the ledger by themselves, so the payment is only voided
        p.status = 'REVERSED';
        p.reversalReason = `Invoice ${invoice.invoiceNo} cancelled`;
        p.reversedAt = new Date();
        p.reversedBy = userId;
        await p.save({ session });
      }

      // 4. cash actually received (excluding old gold) minus cash already refunded
      const cashIn = payments
        .filter((p) => p.direction === 'IN' && p.paymentMode !== 'EXCHANGE')
        .reduce((a, p) => DecimalUtil.add(a, p.amount), 0);
      const cashOut = payments.filter((p) => p.direction === 'OUT').reduce((a, p) => DecimalUtil.add(a, p.amount), 0);
      const netCash = Math.max(0, DecimalUtil.subtract(cashIn, cashOut));

      invoice.status = INVOICE_STATUSES.CANCELLED;
      invoice.cancellationReason = reason;
      invoice.cancelledAt = new Date();
      invoice.cancelledBy = userId;

      let cashRefunded = 0;
      if (paymentAction === PAYMENT_ACTIONS.REFUND && netCash > 0) {
        await PaymentService.recordPayment({
          referenceType: 'INVOICE',
          referenceId: invoice._id,
          entityType: 'CUSTOMER',
          entityId: invoice.customerId,
          amount: netCash,
          paymentMode: refundMode,
          modeDetails: refundModeDetails,
          direction: 'OUT',
          linkedDocType: 'INVOICE_CANCELLATION',
          linkedDocId: invoice._id,
          branchId: invoice.branchId,
          recordedBy: userId,
          notes: `Refund on cancellation of ${invoice.invoiceNo}`,
          internal: true,
          invoiceDoc: invoice,
          session
        });
        cashRefunded = netCash;
      }

      await InvoiceAccounting.recompute(invoice, session, { save: false });
      const summary = {
        paymentAction: netCash > 0 ? paymentAction : 'NONE',
        receivableReversed,
        cashRefunded,
        creditRetained: DecimalUtil.subtract(netCash, cashRefunded)
      };
      invoice.cancellationSummary = summary;
      await invoice.save({ session });

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.CANCEL,
          module: 'INVOICE',
          recordId: invoice._id,
          newValue: { status: 'CANCELLED', reason, ...summary },
          branchId: invoice.branchId
        },
        session
      );

      return invoice;
    });
  }
}

module.exports = BillingService;
