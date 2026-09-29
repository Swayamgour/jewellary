const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Vendor = require('../models/Vendor');
const Inventory = require('../models/Inventory');
const Expense = require('../models/Expense');
const Order = require('../models/Order');
const DecimalUtil = require('../utils/decimal');
const ProfitService = require('./profit.service');
const SalesReturn = require('../models/SalesReturn');
const { LIVE_INVOICE_STATUSES, INVENTORY_STATUSES } = require('../config/constants');

class DashboardService {
  /**
   * Helper to parse date range query
   */
  static getDateRange(filter = 'month', startDate = null, endDate = null) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (filter === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (filter === 'yesterday') {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (filter === 'week') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (filter === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (filter === 'year') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    } else if (filter === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      // Default to current month
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  }

  /**
   * Aggregate Real Dashboard Metrics
   */
  static async getDashboardMetrics({ branchId = null, filter = 'month', startDate = null, endDate = null }) {
    const { start, end } = this.getDateRange(filter, startDate, endDate);

    const branchMatch = branchId ? { branchId: new mongoose.Types.ObjectId(branchId) } : {};

    // 1. Sales (live invoices only: CONVERTED Kacha bills are excluded, the Pakka invoice carries the sale)
    const liveInvoices = await Invoice.find({
      ...branchMatch,
      invoiceDate: { $gte: start, $lte: end },
      status: { $in: LIVE_INVOICE_STATUSES }
    })
      .select('billType grandTotal taxableAmount tax.totalTax')
      .lean();

    const salesStats = { totalSales: 0, totalTaxable: 0, totalTax: 0, kachaSales: 0, pakkaSales: 0, totalInvoicesCount: liveInvoices.length };
    liveInvoices.forEach((inv) => {
      salesStats.totalSales += inv.grandTotal || 0;
      salesStats.totalTaxable += inv.taxableAmount || 0;
      salesStats.totalTax += inv.tax?.totalTax || 0;
      if (inv.billType === 'KACHA') salesStats.kachaSales += inv.grandTotal || 0;
      else salesStats.pakkaSales += inv.grandTotal || 0;
    });

    // 2. Purchases
    const purchases = await Purchase.find({ ...branchMatch, purchaseDate: { $gte: start, $lte: end }, status: 'COMPLETED' })
      .select('grandTotal returnedAmount')
      .lean();
    const purchaseStats = {
      totalPurchase: purchases.reduce((a, p) => a + (p.grandTotal || 0), 0),
      totalReturned: purchases.reduce((a, p) => a + (p.returnedAmount || 0), 0),
      totalPurchasesCount: purchases.length
    };

    // 3. Customer collections by mode (receipts minus refunds; old-gold adjustments are not cash)
    const customerPayments = await Payment.find({
      ...branchMatch,
      paymentDate: { $gte: start, $lte: end },
      status: 'SUCCESS',
      entityType: 'CUSTOMER'
    }).select('amount paymentMode direction');

    const collectionsByMode = { CASH: 0, UPI: 0, CARD: 0, BANK_TRANSFER: 0, CHEQUE: 0, OTHER: 0, EXCHANGE: 0, TOTAL: 0, REFUNDS: 0 };
    customerPayments.forEach((p) => {
      if (p.paymentMode === 'EXCHANGE') {
        if (p.direction === 'IN') collectionsByMode.EXCHANGE = DecimalUtil.add(collectionsByMode.EXCHANGE, p.amount);
        return;
      }
      if (p.direction === 'IN') {
        collectionsByMode[p.paymentMode] = DecimalUtil.add(collectionsByMode[p.paymentMode] || 0, p.amount);
        collectionsByMode.TOTAL = DecimalUtil.add(collectionsByMode.TOTAL, p.amount);
      } else {
        collectionsByMode.REFUNDS = DecimalUtil.add(collectionsByMode.REFUNDS, p.amount);
      }
    });
    collectionsByMode.NET = DecimalUtil.subtract(collectionsByMode.TOTAL, collectionsByMode.REFUNDS);

    // 4. Receivables & Payables (party balances)
    const custs = await Customer.find({ isDeleted: false, ...branchMatch }).select('currentBalance').lean();
    const totalCustomerReceivable = custs.reduce((a, c) => a + (c.currentBalance || 0), 0);
    const vends = await Vendor.find({ isDeleted: false, ...branchMatch }).select('currentBalance').lean();
    const totalVendorPayable = vends.reduce((a, v) => a + (v.currentBalance || 0), 0);

    // 5. Inventory valuation. Weights on a stock row are PER UNIT, so totals are unit x quantity.
    const stockRows = await Inventory.find({
      ...branchMatch,
      isDeleted: false,
      status: INVENTORY_STATUSES.AVAILABLE,
      quantity: { $gt: 0 }
    }).select('metal quantity netWeight costPrice');

    const stockSummary = {
      GOLD: { qty: 0, netWeight: 0, costValue: 0 },
      SILVER: { qty: 0, netWeight: 0, costValue: 0 },
      PLATINUM: { qty: 0, netWeight: 0, costValue: 0 },
      DIAMOND: { qty: 0, netWeight: 0, costValue: 0 },
      OTHER: { qty: 0, netWeight: 0, costValue: 0 }
    };
    stockRows.forEach((row) => {
      const b = stockSummary[row.metal] || stockSummary.OTHER;
      b.qty += row.quantity;
      b.netWeight = DecimalUtil.roundWeight(b.netWeight + row.netWeight * row.quantity);
      b.costValue = DecimalUtil.roundCurrency(b.costValue + row.costPrice * row.quantity);
    });

    // 6. Operating Expenses
    const expenseRows = await Expense.find({ ...branchMatch, expenseDate: { $gte: start, $lte: end } }).select('amount').lean();
    const totalExpense = expenseRows.reduce((a, e) => a + (e.amount || 0), 0);

    // 7. Pending Custom Orders
    const pendingOrdersCount = await Order.countDocuments({
      ...branchMatch,
      status: { $in: ['NEW', 'CONFIRMED', 'MANUFACTURING', 'QC', 'READY'] }
    });

    // 8. Recent Invoices
    const recentInvoices = await Invoice.find({
      ...branchMatch,
      status: { $in: LIVE_INVOICE_STATUSES }
    })
      .sort({ invoiceDate: -1 })
      .limit(5)
      .select('invoiceNo billType invoiceDate customerSnapshot grandTotal paymentStatus status');

    // 9. Profit: net sales - cost of goods sold - expenses (see ProfitService)
    const profit = await ProfitService.compute({ branchId, start, end });

    return {
      period: {
        filter,
        startDate: start,
        endDate: end
      },
      sales: {
        totalSales: DecimalUtil.roundCurrency(salesStats.totalSales),
        taxableAmount: DecimalUtil.roundCurrency(salesStats.totalTaxable),
        taxCollected: DecimalUtil.roundCurrency(salesStats.totalTax),
        kachaSales: DecimalUtil.roundCurrency(salesStats.kachaSales),
        pakkaSales: DecimalUtil.roundCurrency(salesStats.pakkaSales),
        invoiceCount: salesStats.totalInvoicesCount
      },
      purchases: {
        totalPurchase: DecimalUtil.roundCurrency(purchaseStats.totalPurchase),
        purchaseReturns: DecimalUtil.roundCurrency(purchaseStats.totalReturned || 0),
        netPurchase: DecimalUtil.subtract(purchaseStats.totalPurchase, purchaseStats.totalReturned || 0),
        purchaseCount: purchaseStats.totalPurchasesCount
      },
      collections: collectionsByMode,
      outstanding: {
        customerReceivable: DecimalUtil.roundCurrency(totalCustomerReceivable),
        vendorPayable: DecimalUtil.roundCurrency(totalVendorPayable)
      },
      inventory: stockSummary,
      financials: {
        netSales: profit.netSales,
        salesReturns: profit.salesReturns,
        costOfGoodsSold: profit.costOfGoodsSold,
        grossProfit: profit.grossProfit,
        totalExpenses: DecimalUtil.roundCurrency(totalExpense),
        netProfit: profit.netProfit,
        estimatedNetProfit: profit.netProfit, // kept for existing clients
        profitNote: profit.note
      },
      pendingOrdersCount,
      recentInvoices
    };
  }
}

module.exports = DashboardService;
