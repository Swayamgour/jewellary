const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const CustomerLedger = require('../models/CustomerLedger');
const Vendor = require('../models/Vendor');
const VendorLedger = require('../models/VendorLedger');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const Payment = require('../models/Payment');
const InvoiceAccounting = require('./invoiceAccounting.service');
const PurchaseAccounting = require('./purchaseAccounting.service');
const { computeInvoicePayment, computePurchasePayment } = require('../utils/accounting');
const DecimalUtil = require('../utils/decimal');
const { LIVE_INVOICE_STATUSES } = require('../config/constants');

const r2 = (n) => DecimalUtil.roundCurrency(n);
const differs = (a, b) => Math.abs((a || 0) - (b || 0)) > 0.01;

/**
 * Books consistency check.
 *   1. party.currentBalance == sum of its ledger entries
 *   2. invoice.paymentSummary == what its Payment documents + returns say
 *   3. purchase paid / due / refundDue == what its Payment documents + returns say
 * With fix=true, invoices and purchases are re-derived from their payments (balances are only reported:
 * changing a ledger balance must be a deliberate accounting decision).
 */
class ReconciliationService {
  static async run({ branchId = null, fix = false } = {}) {
    const bm = branchId ? { branchId: new mongoose.Types.ObjectId(branchId) } : {};
    const issues = [];

    // 1. ledgers
    // (plain reads instead of $group so this also runs on MongoDB-compatible engines with partial aggregation support)
    const custMap = new Map();
    for (const e of await CustomerLedger.find({}).select('customerId debit credit').lean()) {
      custMap.set(String(e.customerId), r2((custMap.get(String(e.customerId)) || 0) + e.debit - e.credit));
    }
    for (const c of await Customer.find({ isDeleted: false, ...bm }).select('name currentBalance')) {
      const expected = custMap.get(String(c._id)) || 0;
      if (differs(c.currentBalance, expected)) {
        issues.push({ type: 'CUSTOMER_BALANCE', id: c._id, name: c.name, stored: c.currentBalance, ledger: expected, difference: r2(c.currentBalance - expected) });
      }
    }
    const venMap = new Map();
    for (const e of await VendorLedger.find({}).select('vendorId debit credit').lean()) {
      venMap.set(String(e.vendorId), r2((venMap.get(String(e.vendorId)) || 0) + e.credit - e.debit));
    }
    for (const v of await Vendor.find({ isDeleted: false, ...bm }).select('name company currentBalance')) {
      const expected = venMap.get(String(v._id)) || 0;
      if (differs(v.currentBalance, expected)) {
        issues.push({ type: 'VENDOR_BALANCE', id: v._id, name: v.company || v.name, stored: v.currentBalance, ledger: expected, difference: r2(v.currentBalance - expected) });
      }
    }

    // 2. invoices
    const invoices = await Invoice.find({ ...bm, status: { $in: LIVE_INVOICE_STATUSES } });
    let fixed = 0;
    for (const inv of invoices) {
      const pays = await Payment.find({ referenceType: 'INVOICE', referenceId: inv._id, status: 'SUCCESS' });
      const paidIn = pays.filter((p) => p.direction === 'IN').reduce((a, p) => a + p.amount, 0);
      const refunded = pays.filter((p) => p.direction === 'OUT').reduce((a, p) => a + p.amount, 0);
      const exp = computeInvoicePayment({ grandTotal: inv.grandTotal, returnedAmount: inv.returnedAmount, paidIn, refunded });
      if (differs(inv.paymentSummary?.paid, exp.paid) || differs(inv.paymentSummary?.due, exp.due) || differs(inv.paymentSummary?.refunded, exp.refunded)) {
        issues.push({ type: 'INVOICE_PAYMENT', id: inv._id, invoiceNo: inv.invoiceNo, stored: { paid: inv.paymentSummary?.paid, due: inv.paymentSummary?.due }, expected: { paid: exp.paid, due: exp.due } });
        if (fix) {
          await InvoiceAccounting.recompute(inv);
          fixed += 1;
        }
      }
    }

    // 3. purchases
    const purchases = await Purchase.find({ ...bm, status: 'COMPLETED' });
    for (const p of purchases) {
      const pays = await Payment.find({ referenceType: 'PURCHASE', referenceId: p._id, status: 'SUCCESS' });
      const paid = pays.filter((x) => x.direction === 'OUT').reduce((a, x) => a + x.amount, 0);
      const refundReceived = pays.filter((x) => x.direction === 'IN').reduce((a, x) => a + x.amount, 0);
      const exp = computePurchasePayment({ grandTotal: p.grandTotal, returnedAmount: p.returnedAmount, paid, refundReceived });
      if (differs(p.paidAmount, exp.paid) || differs(p.dueAmount, exp.due) || differs(p.refundDue, exp.refundDue)) {
        issues.push({ type: 'PURCHASE_PAYMENT', id: p._id, purchaseNo: p.purchaseNo, stored: { paid: p.paidAmount, due: p.dueAmount }, expected: { paid: exp.paid, due: exp.due } });
        if (fix) {
          await PurchaseAccounting.recompute(p);
          fixed += 1;
        }
      }
    }

    return {
      ok: issues.length === 0,
      checked: { invoices: invoices.length, purchases: purchases.length },
      issueCount: issues.length,
      fixedDocuments: fixed,
      issues
    };
  }
}

module.exports = ReconciliationService;
