const Exchange = require('../models/Exchange');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const LedgerService = require('./ledger.service');
const PaymentService = require('./payment.service');
const Branch = require('../models/Branch');
const { nextDocNo } = require('../utils/sequence');
const { LIVE_INVOICE_STATUSES } = require('../config/constants');
const DecimalUtil = require('../utils/decimal');
const ApiError = require('../utils/apiError');
const { withTransaction } = require('../utils/transaction');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS } = require('../config/constants');

class ExchangeService {
  /**
   * Process customer old gold intake
   */
  static async processOldGoldExchange({
    customerId,
    branchId,
    items,
    invoiceId = null,
    notes = '',
    userId
  }) {
    return await withTransaction(async (session) => {
      const customer = await Customer.findById(customerId).session(session);
      if (!customer) {
        throw ApiError.notFound('Customer not found');
      }

      if (!items || items.length === 0) {
        throw ApiError.badRequest('At least one exchange item must be provided');
      }

      let totalGrossWeight = 0;
      let totalNetWeight = 0;
      let totalExchangeValue = 0;

      const processedItems = items.map((item) => {
        const grossWeight = DecimalUtil.roundWeight(item.grossWeight || 0);
        const stoneWeight = DecimalUtil.roundWeight(item.stoneWeight || 0);

        if (grossWeight < stoneWeight) {
          throw ApiError.badRequest(`Gross weight (${grossWeight}g) cannot be less than stone weight (${stoneWeight}g)`);
        }

        const netWeight = DecimalUtil.subtract(grossWeight, stoneWeight);
        const purityPercent = DecimalUtil.round(item.purityTestedPercent || 91.6, 2);
        const meltingLossPercent = DecimalUtil.round(item.meltingLossPercent || 0, 2);
        const goldRate = DecimalUtil.roundCurrency(item.goldRateApplied || 0);

        // Effective Pure Weight = Net Weight * (Purity / 100) * (1 - MeltingLoss / 100)
        const weightAfterMelting = DecimalUtil.multiply(netWeight, (100 - meltingLossPercent) / 100, 3);
        const pureWeight = DecimalUtil.multiply(weightAfterMelting, purityPercent / 100, 3);
        const meltingLossWeight = DecimalUtil.subtract(netWeight, weightAfterMelting);

        // Value = Pure Weight * 24K Rate (or Net Weight * effective rate)
        const exchangeValue = DecimalUtil.multiply(pureWeight, goldRate);

        totalGrossWeight = DecimalUtil.add(totalGrossWeight, grossWeight);
        totalNetWeight = DecimalUtil.add(totalNetWeight, netWeight);
        totalExchangeValue = DecimalUtil.add(totalExchangeValue, exchangeValue);

        return {
          itemDescription: item.itemDescription,
          metal: item.metal || 'GOLD',
          purityDeclared: item.purityDeclared || '22K',
          testingMethod: item.testingMethod || 'TOUCHSTONE',
          purityTestedPercent: purityPercent,
          grossWeight,
          stoneWeight,
          netWeight,
          meltingLossPercent,
          meltingLossWeight,
          pureWeight,
          goldRateApplied: goldRate,
          exchangeValue
        };
      });

      const branch = await Branch.findById(branchId).select('code').session(session);
      const exchangeNo = await nextDocNo('EXCH', branch?.code || 'BR', session, { model: Exchange, field: 'exchangeNo' });

      const exchange = new Exchange({
        exchangeNo,
        customerId,
        exchangeDate: new Date(),
        items: processedItems,
        totalGrossWeight,
        totalNetWeight,
        totalExchangeValue,
        status: 'PENDING_ADJUSTMENT',
        branchId,
        createdBy: userId,
        notes
      });
      await exchange.save({ session });

      // Old gold received: the shop owes the customer its value (credit) until it is used or paid out
      await LedgerService.postCustomerEntry({
        customerId,
        entryType: 'EXCHANGE',
        referenceType: 'Exchange',
        referenceId: exchange._id,
        description: `Old Gold Exchange - Ref: ${exchange.exchangeNo} (Net Wt: ${totalNetWeight}g)`,
        credit: totalExchangeValue,
        branchId,
        createdBy: userId,
        session
      });

      if (invoiceId) {
        await this.adjustInternal({ exchange, invoiceId, userId, session });
      }

      await logAudit(
        { userId, action: AUDIT_ACTIONS.CREATE, module: 'EXCHANGE', recordId: exchange._id, newValue: exchange.toObject(), branchId },
        session
      );
      return exchange;
    });
  }

  static remaining(exchange) {
    return Math.max(0, DecimalUtil.subtract(exchange.totalExchangeValue, DecimalUtil.add(exchange.adjustedAmount || 0, exchange.paidOutAmount || 0)));
  }

  static refreshStatus(exchange) {
    const rem = this.remaining(exchange);
    if (exchange.status === 'CANCELLED') return;
    if (rem === 0) exchange.status = exchange.paidOutAmount > 0 ? 'PAID_OUT' : 'ADJUSTED_IN_BILL';
    else exchange.status = exchange.adjustedAmount > 0 ? 'PARTIALLY_ADJUSTED' : 'PENDING_ADJUSTMENT';
  }

  /** Use (part of) the old-gold value as payment on an invoice. Value beyond the invoice due stays as credit. */
  static async adjustInternal({ exchange, invoiceId, amount = null, userId, session }) {
    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) throw ApiError.notFound('Invoice not found for exchange adjustment');
    if (!LIVE_INVOICE_STATUSES.includes(invoice.status)) {
      throw ApiError.badRequest(`Old gold can only be adjusted on a confirmed invoice (this one is ${invoice.status})`);
    }
    if (invoice.customerId.toString() !== exchange.customerId.toString()) {
      throw ApiError.badRequest('Exchange customer does not match the invoice customer');
    }
    const due = invoice.paymentSummary?.due || 0;
    const applied = Math.min(this.remaining(exchange), due, amount || Infinity);
    if (!(applied > 0)) {
      throw ApiError.badRequest('Nothing to adjust: the invoice has no due amount or the exchange value is already used');
    }

    const payment = await PaymentService.recordPayment({
      referenceType: 'INVOICE',
      referenceId: invoice._id,
      entityType: 'CUSTOMER',
      entityId: invoice.customerId,
      amount: applied,
      paymentMode: 'EXCHANGE',
      direction: 'IN',
      linkedDocType: 'EXCHANGE',
      linkedDocId: exchange._id,
      postLedger: false, // the ledger was already credited when the gold was received
      internal: true,
      branchId: invoice.branchId,
      recordedBy: userId,
      notes: `Old gold ${exchange.exchangeNo} adjusted on ${invoice.invoiceNo}`,
      invoiceDoc: invoice,
      session
    });

    exchange.adjustments.push({ invoiceId: invoice._id, amount: applied, paymentId: payment._id, at: new Date() });
    exchange.adjustedAmount = DecimalUtil.add(exchange.adjustedAmount || 0, applied);
    if (!exchange.invoiceId) exchange.invoiceId = invoice._id;
    this.refreshStatus(exchange);
    await exchange.save({ session });
    return { exchange, invoice, applied };
  }

  static async adjustToInvoice({ exchangeId, invoiceId, amount, userId }) {
    return withTransaction(async (session) => {
      const exchange = await Exchange.findById(exchangeId).session(session);
      if (!exchange) throw ApiError.notFound('Exchange record not found');
      if (['CANCELLED', 'PAID_OUT', 'ADJUSTED_IN_BILL'].includes(exchange.status)) {
        throw ApiError.badRequest(`Exchange is ${exchange.status} - nothing left to adjust`);
      }
      const result = await this.adjustInternal({ exchange, invoiceId, amount, userId, session });
      await logAudit(
        { userId, action: AUDIT_ACTIONS.UPDATE, module: 'EXCHANGE', recordId: exchange._id, newValue: { adjustedOn: invoiceId, applied: result.applied }, branchId: exchange.branchId },
        session
      );
      return result.exchange;
    });
  }

  /** Pay the unused old-gold value out to the customer. */
  static async payout({ exchangeId, amount, paymentMode, modeDetails = {}, userId }) {
    return withTransaction(async (session) => {
      const exchange = await Exchange.findById(exchangeId).session(session);
      if (!exchange) throw ApiError.notFound('Exchange record not found');
      const rem = this.remaining(exchange);
      if (exchange.status === 'CANCELLED' || rem <= 0) {
        throw ApiError.badRequest('There is no unused value left on this exchange');
      }
      const pay = amount || rem;
      if (pay > rem) throw ApiError.badRequest(`Payout (${pay}) exceeds the unused exchange value (${rem})`);

      const payment = await PaymentService.recordPayment({
        referenceType: 'EXCHANGE',
        referenceId: exchange._id,
        entityType: 'CUSTOMER',
        entityId: exchange.customerId,
        amount: pay,
        paymentMode,
        modeDetails,
        direction: 'OUT',
        linkedDocType: 'EXCHANGE',
        linkedDocId: exchange._id,
        internal: true,
        branchId: exchange.branchId,
        recordedBy: userId,
        notes: `Old gold payout ${exchange.exchangeNo}`,
        session
      });
      exchange.paidOutAmount = DecimalUtil.add(exchange.paidOutAmount || 0, pay);
      exchange.payoutPaymentId = payment._id;
      this.refreshStatus(exchange);
      await exchange.save({ session });
      await logAudit(
        { userId, action: AUDIT_ACTIONS.PAYMENT, module: 'EXCHANGE', recordId: exchange._id, newValue: { paidOut: pay }, branchId: exchange.branchId },
        session
      );
      return exchange;
    });
  }
}

module.exports = ExchangeService;
