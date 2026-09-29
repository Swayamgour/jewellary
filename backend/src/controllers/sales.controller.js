const escapeRegex = require('../utils/escapeRegex');
const Invoice = require('../models/Invoice');
const SalesReturn = require('../models/SalesReturn');
const SalesService = require('../services/sales.service');
const { assertBranchAccess, guardBranch } = require('../utils/branchScope');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { LIVE_INVOICE_STATUSES } = require('../config/constants');

class SalesController {
  static async getSales(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = { status: { $in: LIVE_INVOICE_STATUSES } };
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.billType) query.billType = req.query.billType;
      if (req.query.customerId) query.customerId = req.query.customerId;
      if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;
      if (req.query.search) {
        const rx = { $regex: escapeRegex(req.query.search), $options: 'i' };
        query.$or = [{ invoiceNo: rx }, { 'customerSnapshot.name': rx }, { 'customerSnapshot.mobile': rx }];
      }

      const [sales, total] = await Promise.all([
        Invoice.find(query).skip(skip).limit(limit).sort({ invoiceDate: -1 }),
        Invoice.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Sales invoices fetched', sales, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSaleById(req, res, next) {
    try {
      const sale = await Invoice.findById(req.params.id)
        .populate('customerId')
        .populate('branchId')
        .populate('createdBy', 'name');

      if (!sale) {
        throw ApiError.notFound('Sale record not found');
      }
      assertBranchAccess(req, sale);
      return ApiResponse.success(res, 'Sale details', sale);
    } catch (error) {
      next(error);
    }
  }

  static async recordSalesReturn(req, res, next) {
    try {
      const { items, refundType, refundModeDetails, reason } = req.body;
      await guardBranch(req, Invoice, req.params.id, 'Invoice');
      const salesReturn = await SalesService.createReturn({
        invoiceId: req.params.id,
        items,
        refundType,
        refundModeDetails,
        reason,
        userId: req.user._id
      });
      return ApiResponse.created(res, 'Sales return recorded: stock restored, ledger and refund settled', salesReturn);
    } catch (error) {
      next(error);
    }
  }

  static async getSalesReturns(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const query = {};
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.invoiceId) query.invoiceId = req.query.invoiceId;
      if (req.query.customerId) query.customerId = req.query.customerId;
      const [rows, total] = await Promise.all([
        SalesReturn.find(query).sort({ returnDate: -1 }).skip((page - 1) * limit).limit(limit),
        SalesReturn.countDocuments(query)
      ]);
      return ApiResponse.success(res, 'Sales returns fetched', rows, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SalesController;
