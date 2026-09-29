const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const SalesReturn = require('../models/SalesReturn');
const Expense = require('../models/Expense');
const DecimalUtil = require('../utils/decimal');
const { LIVE_INVOICE_STATUSES } = require('../config/constants');

const r2 = (n) => DecimalUtil.roundCurrency(n);

/**
 * Profit & Loss (accrual basis)
 *
 *   Net sales      = taxable sales of live invoices - taxable value of sales returns   (GST is not income)
 *   COGS           = cost snapshot of items sold    - cost of items returned
 *   Gross profit   = Net sales - COGS
 *   Net profit     = Gross profit - operating expenses
 *
 * Cost of an item is the landed cost recorded on the stock row when it was purchased
 * (metal + making + other charges, excluding GST). Invoices created before cost snapshots existed
 * carry no cost - they are counted in `linesWithoutCost` so the figure is never silently overstated.
 * Kacha bills that were converted are excluded (the Pakka invoice carries the sale).
 */
class ProfitService {
  static async compute({ branchId = null, start, end }) {
    const branchMatch = branchId ? { branchId: new mongoose.Types.ObjectId(branchId) } : {};
    const range = (f) => ({ [f]: { $gte: start, $lte: end } });

    const [invoices, returns, expenses] = await Promise.all([
      Invoice.find({ ...branchMatch, ...range('invoiceDate'), status: { $in: LIVE_INVOICE_STATUSES } })
        .select('taxableAmount discount tax.totalTax items.costAmount items.quantity')
        .lean(),
      SalesReturn.find({ ...branchMatch, ...range('returnDate') }).select('totalTaxable items.costAmount').lean(),
      Expense.find({ ...branchMatch, ...range('expenseDate') }).select('amount category').lean()
    ]);

    let grossSales = 0;
    let discounts = 0;
    let cogsSold = 0;
    let linesWithoutCost = 0;
    for (const inv of invoices) {
      grossSales += inv.taxableAmount || 0;
      discounts += inv.discount || 0;
      for (const it of inv.items || []) {
        cogsSold += it.costAmount || 0;
        if (!it.costAmount) linesWithoutCost += 1;
      }
    }

    let salesReturns = 0;
    let cogsReturned = 0;
    for (const ret of returns) {
      salesReturns += ret.totalTaxable || 0;
      for (const it of ret.items || []) cogsReturned += it.costAmount || 0;
    }

    let totalExpenses = 0;
    const expenseByCategory = {};
    for (const e of expenses) {
      totalExpenses += e.amount || 0;
      expenseByCategory[e.category] = r2((expenseByCategory[e.category] || 0) + e.amount);
    }

    const netSales = r2(grossSales - salesReturns);
    const cogs = r2(cogsSold - cogsReturned);
    const grossProfit = r2(netSales - cogs);
    const netProfit = r2(grossProfit - totalExpenses);

    return {
      period: { startDate: start, endDate: end },
      grossSales: r2(grossSales),
      discountsGiven: r2(discounts),
      salesReturns: r2(salesReturns),
      netSales,
      costOfGoodsSold: cogs,
      grossProfit,
      grossMarginPercent: netSales > 0 ? DecimalUtil.round((grossProfit / netSales) * 100, 2) : 0,
      operatingExpenses: r2(totalExpenses),
      expenseByCategory,
      netProfit,
      invoiceCount: invoices.length,
      linesWithoutCost,
      note:
        linesWithoutCost > 0
          ? `${linesWithoutCost} sold line(s) have no recorded cost (older data) - gross profit is overstated by their cost.`
          : 'Cost of goods is taken from the purchase cost recorded on each stock item at the time of sale.'
    };
  }
}

module.exports = ProfitService;
