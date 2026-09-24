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
const { INVOICE_STATUSES, INVENTORY_STATUSES } = require('../config/constants');

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

    // 1. Sales Aggregations
    const salesAggregate = await Invoice.aggregate([
      {
        $match: {
          ...branchMatch,
          invoiceDate: { $gte: start, $lte: end },
          status: { $nin: [INVOICE_STATUSES.CANCELLED, INVOICE_STATUSES.DRAFT] }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalTaxable: { $sum: '$taxableAmount' },
          totalTax: { $sum: '$tax.totalTax' },
          kachaSales: {
            $sum: {
              $cond: [{ $eq: ['$billType', 'KACHA'] }, '$grandTotal', 0]
            }
          },
          pakkaSales: {
            $sum: {
              $cond: [{ $eq: ['$billType', 'PAKKA'] }, '$grandTotal', 0]
            }
          },
          totalInvoicesCount: { $sum: 1 }
        }
      }
    ]);

    const salesStats = salesAggregate[0] || {
      totalSales: 0,
      totalTaxable: 0,
      totalTax: 0,
      kachaSales: 0,
      pakkaSales: 0,
      totalInvoicesCount: 0
    };

    // 2. Purchases Aggregation
    const purchaseAggregate = await Purchase.aggregate([
      {
        $match: {
          ...branchMatch,
          purchaseDate: { $gte: start, $lte: end },
          status: 'COMPLETED'
        }
      },
      {
        $group: {
          _id: null,
          totalPurchase: { $sum: '$grandTotal' },
          totalPurchasesCount: { $sum: 1 }
        }
      }
    ]);

    const purchaseStats = purchaseAggregate[0] || { totalPurchase: 0, totalPurchasesCount: 0 };

    // 3. Payment Collections by Mode
    const paymentAggregate = await Payment.aggregate([
      {
        $match: {
          ...branchMatch,
          paymentDate: { $gte: start, $lte: end },
          status: 'SUCCESS',
          entityType: 'CUSTOMER'
        }
      },
      {
        $group: {
          _id: '$paymentMode',
          total: { $sum: '$amount' }
        }
      }
    ]);

    const collectionsByMode = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      BANK_TRANSFER: 0,
      CHEQUE: 0,
      EXCHANGE: 0,
      TOTAL: 0
    };

    paymentAggregate.forEach((p) => {
      collectionsByMode[p._id] = DecimalUtil.roundCurrency(p.total);
      collectionsByMode.TOTAL = DecimalUtil.add(collectionsByMode.TOTAL, p.total);
    });

    // 4. Receivables & Payables
    const customerBalanceAgg = await Customer.aggregate([
      { $match: { isDeleted: false, ...branchMatch } },
      { $group: { _id: null, totalReceivable: { $sum: '$currentBalance' } } }
    ]);
    const totalCustomerReceivable = customerBalanceAgg[0]?.totalReceivable || 0;

    const vendorBalanceAgg = await Vendor.aggregate([
      { $match: { isDeleted: false, ...branchMatch } },
      { $group: { _id: null, totalPayable: { $sum: '$currentBalance' } } }
    ]);
    const totalVendorPayable = vendorBalanceAgg[0]?.totalPayable || 0;

    // 5. Inventory Stock Valuation & Quantities
    const inventoryStockAgg = await Inventory.aggregate([
      {
        $match: {
          ...branchMatch,
          isDeleted: false,
          status: INVENTORY_STATUSES.AVAILABLE
        }
      },
      {
        $group: {
          _id: '$metal',
          totalQty: { $sum: '$quantity' },
          totalGrossWeight: { $sum: '$grossWeight' },
          totalNetWeight: { $sum: '$netWeight' },
          totalCostValue: { $sum: '$costPrice' }
        }
      }
    ]);

    const stockSummary = {
      GOLD: { qty: 0, netWeight: 0, costValue: 0 },
      SILVER: { qty: 0, netWeight: 0, costValue: 0 },
      DIAMOND: { qty: 0, netWeight: 0, costValue: 0 },
      OTHER: { qty: 0, netWeight: 0, costValue: 0 }
    };

    inventoryStockAgg.forEach((s) => {
      if (stockSummary[s._id]) {
        stockSummary[s._id] = {
          qty: s.totalQty,
          netWeight: DecimalUtil.roundWeight(s.totalNetWeight),
          costValue: DecimalUtil.roundCurrency(s.totalCostValue)
        };
      }
    });

    // 6. Operating Expenses
    const expenseAgg = await Expense.aggregate([
      {
        $match: {
          ...branchMatch,
          expenseDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalExpense: { $sum: '$amount' }
        }
      }
    ]);
    const totalExpense = expenseAgg[0]?.totalExpense || 0;

    // 7. Pending Custom Orders
    const pendingOrdersCount = await Order.countDocuments({
      ...branchMatch,
      status: { $in: ['NEW', 'CONFIRMED', 'MANUFACTURING', 'QC', 'READY'] }
    });

    // 8. Recent Invoices
    const recentInvoices = await Invoice.find({
      ...branchMatch,
      status: { $ne: INVOICE_STATUSES.CANCELLED }
    })
      .sort({ invoiceDate: -1 })
      .limit(5)
      .select('invoiceNo billType invoiceDate customerSnapshot grandTotal paymentStatus status');

    // 9. True Profit Computation:
    // Net Revenue (Taxable Sales - Discounts) minus Expenses
    const grossRevenue = DecimalUtil.roundCurrency(salesStats.totalTaxable || 0);
    const estimatedNetProfit = DecimalUtil.subtract(grossRevenue, totalExpense);

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
        purchaseCount: purchaseStats.totalPurchasesCount
      },
      collections: collectionsByMode,
      outstanding: {
        customerReceivable: DecimalUtil.roundCurrency(totalCustomerReceivable),
        vendorPayable: DecimalUtil.roundCurrency(totalVendorPayable)
      },
      inventory: stockSummary,
      financials: {
        totalExpenses: DecimalUtil.roundCurrency(totalExpense),
        estimatedNetProfit: DecimalUtil.roundCurrency(estimatedNetProfit)
      },
      pendingOrdersCount,
      recentInvoices
    };
  }
}

module.exports = DashboardService;
