const Customer = require('../models/Customer');
const CustomerLedger = require('../models/CustomerLedger');
const Vendor = require('../models/Vendor');
const VendorLedger = require('../models/VendorLedger');
const DecimalUtil = require('../utils/decimal');
const ApiError = require('../utils/apiError');

class LedgerService {
  /**
   * Post entry to Customer Ledger
   */
  static async postCustomerEntry({
    customerId,
    entryType,
    referenceType,
    referenceId,
    description,
    debit = 0,
    credit = 0,
    branchId,
    createdBy,
    session = null
  }) {
    const customer = await Customer.findById(customerId).session(session);
    if (!customer) {
      throw ApiError.notFound('Customer not found for ledger entry');
    }

    const prevBalance = customer.currentBalance || 0;
    // Debit increases receivable (customer owes us money)
    // Credit decreases receivable (payment, return, exchange)
    const newBalance = DecimalUtil.add(DecimalUtil.subtract(DecimalUtil.add(prevBalance, debit), credit));

    const ledgerEntry = new CustomerLedger({
      customerId,
      entryType,
      referenceType,
      referenceId,
      description,
      debit: DecimalUtil.roundCurrency(debit),
      credit: DecimalUtil.roundCurrency(credit),
      runningBalance: newBalance,
      branchId,
      createdBy,
      transactionDate: new Date()
    });

    await ledgerEntry.save({ session });

    customer.currentBalance = newBalance;
    await customer.save({ session });

    return ledgerEntry;
  }

  /**
   * Post entry to Vendor Ledger
   */
  static async postVendorEntry({
    vendorId,
    entryType,
    referenceType,
    referenceId,
    description,
    debit = 0,
    credit = 0,
    branchId,
    createdBy,
    session = null
  }) {
    const vendor = await Vendor.findById(vendorId).session(session);
    if (!vendor) {
      throw ApiError.notFound('Vendor not found for ledger entry');
    }

    const prevBalance = vendor.currentBalance || 0;
    // Credit increases payable (we owe vendor)
    // Debit decreases payable (we paid vendor, or returned goods)
    const newBalance = DecimalUtil.add(DecimalUtil.subtract(DecimalUtil.add(prevBalance, credit), debit));

    const ledgerEntry = new VendorLedger({
      vendorId,
      entryType,
      referenceType,
      referenceId,
      description,
      debit: DecimalUtil.roundCurrency(debit),
      credit: DecimalUtil.roundCurrency(credit),
      runningBalance: newBalance,
      branchId,
      createdBy,
      transactionDate: new Date()
    });

    await ledgerEntry.save({ session });

    vendor.currentBalance = newBalance;
    await vendor.save({ session });

    return ledgerEntry;
  }
}

module.exports = LedgerService;
