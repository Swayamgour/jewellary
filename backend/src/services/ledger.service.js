const Customer = require('../models/Customer');
const CustomerLedger = require('../models/CustomerLedger');
const Vendor = require('../models/Vendor');
const VendorLedger = require('../models/VendorLedger');
const DecimalUtil = require('../utils/decimal');
const ApiError = require('../utils/apiError');

/**
 * Ledger postings.
 *
 * The party balance is moved with an atomic $inc and the resulting balance is read back from the
 * same operation, so two requests posting at the same moment can never overwrite each other's
 * balance (the previous read-modify-write version could).
 *
 *   Customer:  balance > 0  => customer owes the shop   | balance < 0 => shop owes the customer (credit)
 *   Vendor:    balance > 0  => shop owes the vendor     | balance < 0 => vendor owes the shop (advance)
 */
class LedgerService {
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
    debit = DecimalUtil.roundCurrency(debit);
    credit = DecimalUtil.roundCurrency(credit);
    const delta = DecimalUtil.subtract(debit, credit);

    const customer = await Customer.findOneAndUpdate(
      { _id: customerId },
      { $inc: { currentBalance: delta } },
      { new: true, session }
    );
    if (!customer) {
      throw ApiError.notFound('Customer not found for ledger entry');
    }
    const newBalance = DecimalUtil.roundCurrency(customer.currentBalance);

    const ledgerEntry = new CustomerLedger({
      customerId,
      entryType,
      referenceType,
      referenceId,
      description,
      debit,
      credit,
      runningBalance: newBalance,
      branchId,
      createdBy,
      transactionDate: new Date()
    });
    await ledgerEntry.save({ session });
    return ledgerEntry;
  }

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
    debit = DecimalUtil.roundCurrency(debit);
    credit = DecimalUtil.roundCurrency(credit);
    const delta = DecimalUtil.subtract(credit, debit);

    const vendor = await Vendor.findOneAndUpdate(
      { _id: vendorId },
      { $inc: { currentBalance: delta } },
      { new: true, session }
    );
    if (!vendor) {
      throw ApiError.notFound('Vendor not found for ledger entry');
    }
    const newBalance = DecimalUtil.roundCurrency(vendor.currentBalance);

    const ledgerEntry = new VendorLedger({
      vendorId,
      entryType,
      referenceType,
      referenceId,
      description,
      debit,
      credit,
      runningBalance: newBalance,
      branchId,
      createdBy,
      transactionDate: new Date()
    });
    await ledgerEntry.save({ session });
    return ledgerEntry;
  }
}

module.exports = LedgerService;
