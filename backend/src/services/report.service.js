const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const Inventory = require('../models/Inventory');
const Customer = require('../models/Customer');
const Vendor = require('../models/Vendor');
const Exchange = require('../models/Exchange');
const Expense = require('../models/Expense');
const DecimalUtil = require('../utils/decimal');

class ReportService {
  /**
   * Sales Report with filtering
   */
  static async getSalesReport({ branchId, startDate, endDate, billType, customerId }) {
    const query = { status: { $ne: 'CANCELLED' } };
    if (branchId) query.branchId = branchId;
    if (billType) query.billType = billType;
    if (customerId) query.customerId = customerId;
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }

    const invoices = await Invoice.find(query)
      .sort({ invoiceDate: -1 })
      .populate('customerId', 'name mobile gstin')
      .populate('branchId', 'name code');

    let totalSales = 0;
    let totalTaxable = 0;
    let totalTax = 0;
    let totalPaid = 0;
    let totalDue = 0;

    const list = invoices.map((inv) => {
      totalSales = DecimalUtil.add(totalSales, inv.grandTotal);
      totalTaxable = DecimalUtil.add(totalTaxable, inv.taxableAmount);
      totalTax = DecimalUtil.add(totalTax, inv.tax?.totalTax || 0);
      totalPaid = DecimalUtil.add(totalPaid, inv.paymentSummary?.paid || 0);
      totalDue = DecimalUtil.add(totalDue, inv.paymentSummary?.due || 0);

      return {
        invoiceNo: inv.invoiceNo,
        billType: inv.billType,
        invoiceDate: inv.invoiceDate,
        customerName: inv.customerSnapshot?.name || inv.customerId?.name,
        customerMobile: inv.customerSnapshot?.mobile || inv.customerId?.mobile,
        taxableAmount: inv.taxableAmount,
        taxAmount: inv.tax?.totalTax || 0,
        grandTotal: inv.grandTotal,
        paid: inv.paymentSummary?.paid || 0,
        due: inv.paymentSummary?.due || 0,
        status: inv.status,
        paymentStatus: inv.paymentStatus
      };
    });

    return {
      summary: {
        count: list.length,
        totalSales,
        totalTaxable,
        totalTax,
        totalPaid,
        totalDue
      },
      data: list
    };
  }

  /**
   * Inventory Valuation Report
   */
  static async getInventoryReport({ branchId, metal, categoryId }) {
    const query = { isDeleted: false, status: 'AVAILABLE' };
    if (branchId) query.branchId = branchId;
    if (metal) query.metal = metal;
    if (categoryId) query.categoryId = categoryId;

    const items = await Inventory.find(query)
      .populate('productId', 'name code')
      .populate('categoryId', 'name code')
      .sort({ createdAt: -1 });

    let totalWeight = 0;
    let totalCost = 0;
    let totalQty = 0;

    const list = items.map((i) => {
      totalWeight = DecimalUtil.add(totalWeight, i.netWeight);
      totalCost = DecimalUtil.add(totalCost, i.costPrice * i.quantity);
      totalQty += i.quantity;

      return {
        barcode: i.barcode,
        productName: i.productId?.name,
        category: i.categoryId?.name,
        metal: i.metal,
        purity: i.purity,
        grossWeight: i.grossWeight,
        netWeight: i.netWeight,
        quantity: i.quantity,
        costPrice: i.costPrice,
        location: i.warehouseLocation
      };
    });

    return {
      summary: {
        totalPieces: totalQty,
        totalNetWeight: DecimalUtil.roundWeight(totalWeight),
        totalValuation: DecimalUtil.roundCurrency(totalCost)
      },
      data: list
    };
  }

  /**
   * Customer Outstanding Report
   */
  static async getCustomerOutstandingReport({ branchId }) {
    const query = { isDeleted: false, currentBalance: { $gt: 0 } };
    if (branchId) query.branchId = branchId;

    const customers = await Customer.find(query).sort({ currentBalance: -1 });

    const totalOutstanding = customers.reduce((acc, c) => DecimalUtil.add(acc, c.currentBalance), 0);

    return {
      summary: {
        customerCount: customers.length,
        totalOutstanding: DecimalUtil.roundCurrency(totalOutstanding)
      },
      data: customers.map((c) => ({
        id: c._id,
        name: c.name,
        mobile: c.mobile,
        city: c.address?.city,
        state: c.address?.state,
        balance: c.currentBalance
      }))
    };
  }

  /**
   * Vendor Outstanding Report
   */
  static async getVendorOutstandingReport({ branchId }) {
    const query = { isDeleted: false, currentBalance: { $gt: 0 } };
    if (branchId) query.branchId = branchId;

    const vendors = await Vendor.find(query).sort({ currentBalance: -1 });
    const totalPayable = vendors.reduce((acc, v) => DecimalUtil.add(acc, v.currentBalance), 0);

    return {
      summary: {
        vendorCount: vendors.length,
        totalPayable: DecimalUtil.roundCurrency(totalPayable)
      },
      data: vendors.map((v) => ({
        id: v._id,
        name: v.name,
        company: v.company,
        mobile: v.mobile,
        balance: v.currentBalance
      }))
    };
  }

  /**
   * Generate Excel Workbook Buffer
   */
  static async exportToExcel(sheetName, columns, data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 15
    }));

    // Header styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A365D' }
    };

    data.forEach((row) => {
      worksheet.addRow(row);
    });

    return await workbook.xlsx.writeBuffer();
  }
}

module.exports = ReportService;
