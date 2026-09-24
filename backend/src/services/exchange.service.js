const Exchange = require('../models/Exchange');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const LedgerService = require('./ledger.service');
const BarcodeGenerator = require('../utils/barcodeGenerator');
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

      const exchangeNo = BarcodeGenerator.generateInvoiceNo('EXCH', 'BR', Math.floor(1000 + Math.random() * 9000));

      const exchange = new Exchange({
        exchangeNo,
        customerId,
        exchangeDate: new Date(),
        items: processedItems,
        totalGrossWeight,
        totalNetWeight,
        totalExchangeValue,
        status: invoiceId ? 'ADJUSTED_IN_BILL' : 'PENDING_ADJUSTMENT',
        invoiceId,
        branchId,
        createdBy: userId,
        notes
      });

      await exchange.save({ session });

      // If tied to an invoice, adjust invoice payment and customer ledger
      if (invoiceId) {
        const invoice = await Invoice.findById(invoiceId).session(session);
        if (invoice) {
          invoice.paymentSummary.exchangeAdjusted = DecimalUtil.add(
            invoice.paymentSummary.exchangeAdjusted || 0,
            totalExchangeValue
          );
          invoice.paymentSummary.paid = DecimalUtil.add(invoice.paymentSummary.paid, totalExchangeValue);
          invoice.paymentSummary.due = Math.max(0, DecimalUtil.subtract(invoice.grandTotal, invoice.paymentSummary.paid));
          if (invoice.paymentSummary.due === 0) {
            invoice.paymentStatus = 'PAID';
            invoice.status = 'PAID';
          } else {
            invoice.paymentStatus = 'PARTIAL';
          }
          await invoice.save({ session });
        }
      }

      // Post Credit to Customer Ledger (Old gold reduces customer outstanding)
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

      await logAudit(
        {
          userId,
          action: AUDIT_ACTIONS.CREATE,
          module: 'EXCHANGE',
          recordId: exchange._id,
          newValue: exchange.toObject(),
          branchId
        },
        session
      );

      return exchange;
    });
  }
}

module.exports = ExchangeService;
