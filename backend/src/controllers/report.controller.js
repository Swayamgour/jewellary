const ReportService = require('../services/report.service');
const ApiResponse = require('../utils/apiResponse');

class ReportController {
  static async getSalesReport(req, res, next) {
    try {
      const branchId = req.branchId || req.query.branchId;
      const { startDate, endDate, billType, customerId } = req.query;

      const report = await ReportService.getSalesReport({
        branchId,
        startDate,
        endDate,
        billType,
        customerId
      });

      return ApiResponse.success(res, 'Sales report generated', report);
    } catch (error) {
      next(error);
    }
  }

  static async getStockReport(req, res, next) {
    try {
      const branchId = req.branchId || req.query.branchId;
      const { metal, categoryId } = req.query;

      const report = await ReportService.getInventoryReport({
        branchId,
        metal,
        categoryId
      });

      return ApiResponse.success(res, 'Inventory report generated', report);
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerOutstandingReport(req, res, next) {
    try {
      const branchId = req.branchId || req.query.branchId;
      const report = await ReportService.getCustomerOutstandingReport({ branchId });
      return ApiResponse.success(res, 'Customer outstanding report generated', report);
    } catch (error) {
      next(error);
    }
  }

  static async getVendorOutstandingReport(req, res, next) {
    try {
      const branchId = req.branchId || req.query.branchId;
      const report = await ReportService.getVendorOutstandingReport({ branchId });
      return ApiResponse.success(res, 'Vendor outstanding report generated', report);
    } catch (error) {
      next(error);
    }
  }

  static async exportExcelReport(req, res, next) {
    try {
      const { reportType } = req.query;
      const branchId = req.branchId || req.query.branchId;

      let buffer = null;
      let filename = 'report.xlsx';

      if (reportType === 'sales') {
        const report = await ReportService.getSalesReport({ branchId });
        const columns = [
          { header: 'Invoice No', key: 'invoiceNo', width: 22 },
          { header: 'Type', key: 'billType', width: 10 },
          { header: 'Date', key: 'invoiceDate', width: 15 },
          { header: 'Customer', key: 'customerName', width: 20 },
          { header: 'Taxable (₹)', key: 'taxableAmount', width: 15 },
          { header: 'Tax (₹)', key: 'taxAmount', width: 12 },
          { header: 'Grand Total (₹)', key: 'grandTotal', width: 16 },
          { header: 'Paid (₹)', key: 'paid', width: 14 },
          { header: 'Due (₹)', key: 'due', width: 14 },
          { header: 'Status', key: 'status', width: 12 }
        ];
        buffer = await ReportService.exportToExcel('Sales Report', columns, report.data);
        filename = `sales_report_${Date.now()}.xlsx`;
      } else {
        const report = await ReportService.getInventoryReport({ branchId });
        const columns = [
          { header: 'Barcode', key: 'barcode', width: 20 },
          { header: 'Product', key: 'productName', width: 25 },
          { header: 'Category', key: 'category', width: 15 },
          { header: 'Metal', key: 'metal', width: 12 },
          { header: 'Purity', key: 'purity', width: 10 },
          { header: 'Gross Wt (g)', key: 'grossWeight', width: 14 },
          { header: 'Net Wt (g)', key: 'netWeight', width: 14 },
          { header: 'Quantity', key: 'quantity', width: 10 },
          { header: 'Cost Price (₹)', key: 'costPrice', width: 15 },
          { header: 'Location', key: 'location', width: 15 }
        ];
        buffer = await ReportService.exportToExcel('Inventory Report', columns, report.data);
        filename = `inventory_report_${Date.now()}.xlsx`;
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReportController;
