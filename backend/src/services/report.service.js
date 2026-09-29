const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const PurchaseReturn = require('../models/PurchaseReturn');
const SalesReturn = require('../models/SalesReturn');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const Customer = require('../models/Customer');
const Vendor = require('../models/Vendor');
const Exchange = require('../models/Exchange');
const Expense = require('../models/Expense');
const Payment = require('../models/Payment');
const DecimalUtil = require('../utils/decimal');
const ProfitService = require('./profit.service');
const { LIVE_INVOICE_STATUSES } = require('../config/constants');

const r2 = (n) => DecimalUtil.roundCurrency(n);
const w3 = (n) => DecimalUtil.roundWeight(n);

function dateFilter(field, startDate, endDate) {
  if (!startDate && !endDate) return {};
  const f = {};
  if (startDate) f.$gte = new Date(startDate);
  if (endDate) {
    const e = new Date(endDate);
    if (String(endDate).length <= 10) e.setHours(23, 59, 59, 999);
    f.$lte = e;
  }
  return { [field]: f };
}

function period(startDate, endDate) {
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = startDate ? new Date(startDate) : new Date(end.getFullYear(), end.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

const withBranch = (q, branchId) => (branchId ? { ...q, branchId } : q);

class ReportService {
  // ------------------------------------------------------------------ sales
  static async getSalesReport({ branchId, startDate, endDate, billType, customerId }) {
    // CONVERTED Kacha bills are excluded: the Pakka invoice that replaced them carries the sale
    const query = withBranch({ status: { $in: LIVE_INVOICE_STATUSES }, ...dateFilter('invoiceDate', startDate, endDate) }, branchId);
    if (billType) query.billType = billType;
    if (customerId) query.customerId = customerId;

    const invoices = await Invoice.find(query).sort({ invoiceDate: -1 }).populate('customerId', 'name mobile gstin').populate('branchId', 'name code');

    const t = { totalSales: 0, totalTaxable: 0, totalTax: 0, totalReturned: 0, totalPaid: 0, totalDue: 0 };
    const list = invoices.map((inv) => {
      t.totalSales = r2(t.totalSales + inv.grandTotal);
      t.totalTaxable = r2(t.totalTaxable + inv.taxableAmount);
      t.totalTax = r2(t.totalTax + (inv.tax?.totalTax || 0));
      t.totalReturned = r2(t.totalReturned + (inv.returnedAmount || 0));
      t.totalPaid = r2(t.totalPaid + (inv.paymentSummary?.paid || 0));
      t.totalDue = r2(t.totalDue + (inv.paymentSummary?.due || 0));
      return {
        invoiceNo: inv.invoiceNo,
        billType: inv.billType,
        invoiceDate: inv.invoiceDate,
        customerName: inv.customerSnapshot?.name || inv.customerId?.name,
        customerMobile: inv.customerSnapshot?.mobile || inv.customerId?.mobile,
        taxableAmount: inv.taxableAmount,
        taxAmount: inv.tax?.totalTax || 0,
        grandTotal: inv.grandTotal,
        returned: inv.returnedAmount || 0,
        paid: inv.paymentSummary?.paid || 0,
        due: inv.paymentSummary?.due || 0,
        status: inv.status,
        paymentStatus: inv.paymentStatus
      };
    });
    return { summary: { count: list.length, ...t, netSales: r2(t.totalSales - t.totalReturned) }, data: list };
  }

  static async getSalesReturnReport({ branchId, startDate, endDate, customerId }) {
    const query = withBranch({ ...dateFilter('returnDate', startDate, endDate) }, branchId);
    if (customerId) query.customerId = customerId;
    const rows = await SalesReturn.find(query).sort({ returnDate: -1 }).populate('customerId', 'name mobile');
    const data = rows.map((r) => ({
      returnNo: r.returnNo,
      returnDate: r.returnDate,
      invoiceNo: r.invoiceNo,
      customerName: r.customerId?.name,
      items: r.items.map((i) => `${i.productName} x${i.quantity}`).join(', '),
      taxable: r.totalTaxable,
      tax: r.totalTax,
      totalValue: r.totalRefundAmount,
      cashRefunded: r.settlement?.cashRefunded || 0,
      creditRetained: r.settlement?.creditRetained || 0,
      refundType: r.refundType,
      reason: r.reason
    }));
    return {
      summary: {
        count: data.length,
        totalValue: r2(data.reduce((a, d) => a + d.totalValue, 0)),
        totalCashRefunded: r2(data.reduce((a, d) => a + d.cashRefunded, 0)),
        totalCreditRetained: r2(data.reduce((a, d) => a + d.creditRetained, 0))
      },
      data
    };
  }

  // ------------------------------------------------------------------ purchase
  static async getPurchaseReport({ branchId, startDate, endDate, vendorId }) {
    const query = withBranch({ status: 'COMPLETED', ...dateFilter('purchaseDate', startDate, endDate) }, branchId);
    if (vendorId) query.vendorId = vendorId;
    const rows = await Purchase.find(query).sort({ purchaseDate: -1 }).populate('vendorId', 'name company');
    const data = rows.map((p) => ({
      purchaseNo: p.purchaseNo,
      purchaseDate: p.purchaseDate,
      vendor: p.vendorId?.company || p.vendorId?.name,
      vendorInvoiceNo: p.vendorInvoiceNo,
      taxable: p.subtotal,
      tax: p.taxAmount,
      grandTotal: p.grandTotal,
      returned: p.returnedAmount || 0,
      adjustedTotal: p.adjustedTotal ?? p.grandTotal,
      paid: p.paidAmount,
      due: p.dueAmount,
      refundDue: p.refundDue || 0,
      paymentStatus: p.paymentStatus
    }));
    const sum = (k) => r2(data.reduce((a, d) => a + (d[k] || 0), 0));
    return {
      summary: { count: data.length, totalPurchase: sum('grandTotal'), totalTax: sum('tax'), totalReturned: sum('returned'), netPurchase: sum('adjustedTotal'), totalPaid: sum('paid'), totalDue: sum('due'), totalRefundDue: sum('refundDue') },
      data
    };
  }

  static async getPurchaseReturnReport({ branchId, startDate, endDate, vendorId }) {
    const query = withBranch({ ...dateFilter('returnDate', startDate, endDate) }, branchId);
    if (vendorId) query.vendorId = vendorId;
    const rows = await PurchaseReturn.find(query).sort({ returnDate: -1 }).populate('vendorId', 'name company');
    const data = rows.map((r) => ({
      returnNo: r.returnNo,
      returnDate: r.returnDate,
      purchaseNo: r.purchaseNo,
      vendor: r.vendorId?.company || r.vendorId?.name,
      items: r.items.map((i) => `${i.productName} x${i.quantity}`).join(', '),
      taxable: r.totalTaxable,
      tax: r.totalTax,
      totalAmount: r.totalAmount,
      adjustedDue: r.reconciliation?.adjustedDue || 0,
      refundDue: r.reconciliation?.refundDue || 0,
      reason: r.reason
    }));
    return { summary: { count: data.length, totalReturned: r2(data.reduce((a, d) => a + d.totalAmount, 0)) }, data };
  }

  // ------------------------------------------------------------------ stock
  static async getInventoryReport({ branchId, metal, categoryId, purity }) {
    const query = withBranch({ isDeleted: false, status: 'AVAILABLE', quantity: { $gt: 0 } }, branchId);
    if (metal) query.metal = metal;
    if (purity) query.purity = purity;
    if (categoryId) query.categoryId = categoryId;

    const items = await Inventory.find(query).populate('productId', 'name code').populate('categoryId', 'name code').sort({ createdAt: -1 });

    let totalWeight = 0;
    let totalGross = 0;
    let totalCost = 0;
    let totalQty = 0;
    const list = items.map((i) => {
      const netW = w3(i.netWeight * i.quantity);
      const grossW = w3(i.grossWeight * i.quantity);
      const cost = r2(i.costPrice * i.quantity);
      totalWeight += netW;
      totalGross += grossW;
      totalCost += cost;
      totalQty += i.quantity;
      return {
        barcode: i.barcode,
        productName: i.productId?.name,
        category: i.categoryId?.name,
        metal: i.metal,
        purity: i.purity,
        unitGrossWeight: i.grossWeight,
        unitNetWeight: i.netWeight,
        quantity: i.quantity,
        grossWeight: grossW, // total for the row (unit x quantity)
        netWeight: netW,
        unitCost: i.costPrice,
        costPrice: i.costPrice,
        totalCost: cost,
        location: i.warehouseLocation
      };
    });
    return {
      summary: { totalPieces: totalQty, totalGrossWeight: w3(totalGross), totalNetWeight: w3(totalWeight), totalValuation: r2(totalCost) },
      data: list
    };
  }

  static async getMetalStockReport({ branchId, metal }) {
    const base = await this.getInventoryReport({ branchId, metal });
    const byPurity = {};
    for (const row of base.data) {
      const b = (byPurity[row.purity] = byPurity[row.purity] || { purity: row.purity, pieces: 0, grossWeight: 0, netWeight: 0, totalCost: 0 });
      b.pieces += row.quantity;
      b.grossWeight = w3(b.grossWeight + row.grossWeight);
      b.netWeight = w3(b.netWeight + row.netWeight);
      b.totalCost = r2(b.totalCost + row.totalCost);
    }
    return { summary: { metal, ...base.summary }, data: Object.values(byPurity), items: base.data };
  }

  static async getStockMovementReport({ branchId, startDate, endDate, movementType, barcode }) {
    const query = withBranch({ ...dateFilter('createdAt', startDate, endDate) }, branchId);
    if (movementType) query.movementType = movementType;
    if (barcode) query.barcode = barcode.toUpperCase();
    const rows = await StockMovement.find(query).sort({ createdAt: -1 }).limit(2000).populate('performedBy', 'name');

    const byType = {};
    for (const m of rows) {
      const b = (byType[m.movementType] = byType[m.movementType] || { movementType: m.movementType, entries: 0, quantity: 0, weight: 0 });
      b.entries += 1;
      b.quantity += m.quantityDelta;
      b.weight = w3(b.weight + m.weightDelta);
    }
    return {
      summary: { count: rows.length, byType: Object.values(byType), truncatedAt: rows.length === 2000 ? 2000 : null },
      data: rows.map((m) => ({
        date: m.createdAt,
        barcode: m.barcode,
        movementType: m.movementType,
        quantityDelta: m.quantityDelta,
        weightDelta: m.weightDelta,
        balanceQuantity: m.balanceQuantity,
        balanceWeight: m.balanceWeight,
        referenceType: m.referenceType,
        reason: m.reason,
        by: m.performedBy?.name
      }))
    };
  }

  // ------------------------------------------------------------------ money
  static async getPaymentReport({ branchId, startDate, endDate, paymentMode, entityType, direction, status = 'SUCCESS' }) {
    const query = withBranch({ ...dateFilter('paymentDate', startDate, endDate) }, branchId);
    if (paymentMode) query.paymentMode = paymentMode;
    if (entityType) query.entityType = entityType;
    if (direction) query.direction = direction;
    if (status !== 'ALL') query.status = status;
    const rows = await Payment.find(query).sort({ paymentDate: -1 }).populate('recordedBy', 'name');

    const byMode = {};
    let totalIn = 0;
    let totalOut = 0;
    for (const p of rows) {
      const b = (byMode[p.paymentMode] = byMode[p.paymentMode] || { paymentMode: p.paymentMode, in: 0, out: 0 });
      if (p.direction === 'IN') {
        b.in = r2(b.in + p.amount);
        totalIn = r2(totalIn + p.amount);
      } else {
        b.out = r2(b.out + p.amount);
        totalOut = r2(totalOut + p.amount);
      }
    }
    return {
      summary: { count: rows.length, totalIn, totalOut, net: r2(totalIn - totalOut), byMode: Object.values(byMode) },
      data: rows.map((p) => ({
        paymentNo: p.paymentNo,
        paymentDate: p.paymentDate,
        direction: p.direction,
        entityType: p.entityType,
        referenceType: p.referenceType,
        paymentMode: p.paymentMode,
        amount: p.amount,
        status: p.status,
        linkedDocType: p.linkedDocType || '',
        recordedBy: p.recordedBy?.name,
        notes: p.notes
      }))
    };
  }

  /** Money collected from customers (receipts minus refunds), by mode and by day. Old-gold adjustments are not cash. */
  static async getCollectionReport({ branchId, startDate, endDate }) {
    const query = withBranch({ entityType: 'CUSTOMER', status: 'SUCCESS', ...dateFilter('paymentDate', startDate, endDate) }, branchId);
    const rows = await Payment.find(query).sort({ paymentDate: 1 });
    const byMode = {};
    const byDay = {};
    let received = 0;
    let refunded = 0;
    let exchangeAdjusted = 0;
    for (const p of rows) {
      if (p.paymentMode === 'EXCHANGE') {
        if (p.direction === 'IN') exchangeAdjusted = r2(exchangeAdjusted + p.amount);
        continue;
      }
      const sign = p.direction === 'IN' ? 1 : -1;
      if (sign > 0) received = r2(received + p.amount);
      else refunded = r2(refunded + p.amount);
      byMode[p.paymentMode] = r2((byMode[p.paymentMode] || 0) + sign * p.amount);
      const day = p.paymentDate.toISOString().slice(0, 10);
      byDay[day] = r2((byDay[day] || 0) + sign * p.amount);
    }
    return {
      summary: { received, refunded, netCollection: r2(received - refunded), oldGoldAdjusted: exchangeAdjusted, byMode },
      data: Object.entries(byDay).map(([date, amount]) => ({ date, amount }))
    };
  }

  static async getExpenseReport({ branchId, startDate, endDate, category }) {
    const query = withBranch({ ...dateFilter('expenseDate', startDate, endDate) }, branchId);
    if (category) query.category = category.toUpperCase();
    const rows = await Expense.find(query).sort({ expenseDate: -1 }).populate('recordedBy', 'name');
    const byCategory = {};
    const byMode = {};
    let total = 0;
    for (const e of rows) {
      total = r2(total + e.amount);
      byCategory[e.category] = r2((byCategory[e.category] || 0) + e.amount);
      byMode[e.paymentMode] = r2((byMode[e.paymentMode] || 0) + e.amount);
    }
    return {
      summary: { count: rows.length, totalExpense: total, byCategory, byMode },
      data: rows.map((e) => ({ expenseNo: e.expenseNo, expenseDate: e.expenseDate, title: e.title, category: e.category, paymentMode: e.paymentMode, amount: e.amount, recordedBy: e.recordedBy?.name, notes: e.notes }))
    };
  }

  /**
   * Cash summary: every rupee that moved in / out by payment mode.
   *   IN  : customer receipts, vendor refunds
   *   OUT : vendor payments, customer refunds / old-gold payouts, expenses
   * (Old-gold adjustments are excluded - no money moves. There is no stored opening balance.)
   */
  static async getCashSummary({ branchId, startDate, endDate }) {
    const payQ = withBranch({ status: 'SUCCESS', paymentMode: { $ne: 'EXCHANGE' }, ...dateFilter('paymentDate', startDate, endDate) }, branchId);
    const [payments, expenses] = await Promise.all([
      Payment.find(payQ),
      Expense.find(withBranch({ ...dateFilter('expenseDate', startDate, endDate) }, branchId))
    ]);
    const modes = {};
    const bucket = (m) => (modes[m] = modes[m] || { paymentMode: m, customerReceipts: 0, vendorRefunds: 0, vendorPayments: 0, customerRefunds: 0, expenses: 0 });
    for (const p of payments) {
      const b = bucket(p.paymentMode);
      if (p.entityType === 'CUSTOMER') p.direction === 'IN' ? (b.customerReceipts = r2(b.customerReceipts + p.amount)) : (b.customerRefunds = r2(b.customerRefunds + p.amount));
      else p.direction === 'OUT' ? (b.vendorPayments = r2(b.vendorPayments + p.amount)) : (b.vendorRefunds = r2(b.vendorRefunds + p.amount));
    }
    for (const e of expenses) {
      const b = bucket(e.paymentMode);
      b.expenses = r2(b.expenses + e.amount);
    }
    const data = Object.values(modes).map((b) => {
      const inflow = r2(b.customerReceipts + b.vendorRefunds);
      const outflow = r2(b.vendorPayments + b.customerRefunds + b.expenses);
      return { ...b, totalIn: inflow, totalOut: outflow, net: r2(inflow - outflow) };
    });
    const sum = (k) => r2(data.reduce((a, d) => a + d[k], 0));
    return { summary: { totalIn: sum('totalIn'), totalOut: sum('totalOut'), net: sum('net') }, data };
  }

  static async getProfitLoss({ branchId, startDate, endDate }) {
    const { start, end } = period(startDate, endDate);
    const pl = await ProfitService.compute({ branchId, start, end });
    return { summary: pl, data: [pl] };
  }

  // ------------------------------------------------------------------ exchange / old gold
  static async getExchangeReport({ branchId, startDate, endDate, customerId, status }) {
    const query = withBranch({ ...dateFilter('exchangeDate', startDate, endDate) }, branchId);
    if (customerId) query.customerId = customerId;
    if (status) query.status = status;
    const rows = await Exchange.find(query).sort({ exchangeDate: -1 }).populate('customerId', 'name mobile');
    const data = rows.map((e) => ({
      exchangeNo: e.exchangeNo,
      exchangeDate: e.exchangeDate,
      customer: e.customerId?.name,
      grossWeight: e.totalGrossWeight,
      netWeight: e.totalNetWeight,
      pureWeight: w3(e.items.reduce((a, i) => a + i.pureWeight, 0)),
      exchangeValue: e.totalExchangeValue,
      adjusted: e.adjustedAmount || 0,
      paidOut: e.paidOutAmount || 0,
      unused: r2(e.totalExchangeValue - (e.adjustedAmount || 0) - (e.paidOutAmount || 0)),
      status: e.status
    }));
    return {
      summary: {
        count: data.length,
        totalNetWeight: w3(data.reduce((a, d) => a + d.netWeight, 0)),
        totalPureWeight: w3(data.reduce((a, d) => a + d.pureWeight, 0)),
        totalValue: r2(data.reduce((a, d) => a + d.exchangeValue, 0)),
        totalAdjusted: r2(data.reduce((a, d) => a + d.adjusted, 0)),
        totalPaidOut: r2(data.reduce((a, d) => a + d.paidOut, 0)),
        totalUnused: r2(data.reduce((a, d) => a + d.unused, 0))
      },
      data
    };
  }

  /** Old metal received from customers, grouped by metal + tested purity (what is sitting in the shop as scrap). */
  static async getOldGoldReport({ branchId, startDate, endDate }) {
    const query = withBranch({ status: { $ne: 'CANCELLED' }, ...dateFilter('exchangeDate', startDate, endDate) }, branchId);
    const rows = await Exchange.find(query);
    const groups = {};
    for (const e of rows) {
      for (const i of e.items) {
        const key = `${i.metal}|${i.purityDeclared}`;
        const g = (groups[key] = groups[key] || { metal: i.metal, purity: i.purityDeclared, pieces: 0, grossWeight: 0, netWeight: 0, meltingLossWeight: 0, pureWeight: 0, value: 0 });
        g.pieces += 1;
        g.grossWeight = w3(g.grossWeight + i.grossWeight);
        g.netWeight = w3(g.netWeight + i.netWeight);
        g.meltingLossWeight = w3(g.meltingLossWeight + (i.meltingLossWeight || 0));
        g.pureWeight = w3(g.pureWeight + i.pureWeight);
        g.value = r2(g.value + i.exchangeValue);
      }
    }
    const data = Object.values(groups);
    return {
      summary: { totalNetWeight: w3(data.reduce((a, d) => a + d.netWeight, 0)), totalPureWeight: w3(data.reduce((a, d) => a + d.pureWeight, 0)), totalValue: r2(data.reduce((a, d) => a + d.value, 0)) },
      data
    };
  }

  // ------------------------------------------------------------------ outstanding
  static async getCustomerOutstandingReport({ branchId }) {
    const query = withBranch({ isDeleted: false, currentBalance: { $ne: 0 } }, branchId);
    const customers = await Customer.find(query).sort({ currentBalance: -1 });
    const owing = customers.filter((c) => c.currentBalance > 0);
    const credit = customers.filter((c) => c.currentBalance < 0);
    return {
      summary: {
        customerCount: owing.length,
        totalOutstanding: r2(owing.reduce((a, c) => a + c.currentBalance, 0)),
        customersWithCredit: credit.length,
        totalCustomerCredit: r2(credit.reduce((a, c) => a + Math.abs(c.currentBalance), 0))
      },
      data: customers.map((c) => ({ id: c._id, name: c.name, mobile: c.mobile, city: c.address?.city, state: c.address?.state, balance: c.currentBalance, type: c.currentBalance > 0 ? 'RECEIVABLE' : 'CREDIT' }))
    };
  }

  static async getVendorOutstandingReport({ branchId }) {
    const query = withBranch({ isDeleted: false, currentBalance: { $ne: 0 } }, branchId);
    const vendors = await Vendor.find(query).sort({ currentBalance: -1 });
    const owing = vendors.filter((v) => v.currentBalance > 0);
    const advance = vendors.filter((v) => v.currentBalance < 0);
    return {
      summary: {
        vendorCount: owing.length,
        totalPayable: r2(owing.reduce((a, v) => a + v.currentBalance, 0)),
        vendorsWithAdvance: advance.length,
        totalVendorAdvance: r2(advance.reduce((a, v) => a + Math.abs(v.currentBalance), 0))
      },
      data: vendors.map((v) => ({ id: v._id, name: v.name, company: v.company, mobile: v.mobile, balance: v.currentBalance, type: v.currentBalance > 0 ? 'PAYABLE' : 'ADVANCE' }))
    };
  }

  // ------------------------------------------------------------------ excel
  static async exportToExcel(sheetName, columns, data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = columns.map((col) => ({ header: col.header, key: col.key, width: col.width || 15 }));
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
    data.forEach((row) => worksheet.addRow(row));
    return await workbook.xlsx.writeBuffer();
  }
}

module.exports = ReportService;
