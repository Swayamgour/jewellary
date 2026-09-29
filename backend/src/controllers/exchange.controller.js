const Exchange = require('../models/Exchange');
const ExchangeService = require('../services/exchange.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { assertBranchAccess, guardBranch } = require('../utils/branchScope');

class ExchangeController {
  static async createExchange(req, res, next) {
    try {
      const { customerId, items, invoiceId, notes } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      const exchange = await ExchangeService.processOldGoldExchange({
        customerId,
        branchId,
        items,
        invoiceId,
        notes,
        userId: req.user._id
      });

      return ApiResponse.created(res, 'Old gold exchange processed successfully', exchange);
    } catch (error) {
      next(error);
    }
  }

  static async getExchanges(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = {};
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.customerId) query.customerId = req.query.customerId;
      if (req.query.status) query.status = req.query.status;

      const [exchanges, total] = await Promise.all([
        Exchange.find(query)
          .populate('customerId', 'name mobile')
          .populate('createdBy', 'name')
          .skip(skip)
          .limit(limit)
          .sort({ exchangeDate: -1 }),
        Exchange.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Exchanges fetched successfully', exchanges, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExchangeById(req, res, next) {
    try {
      const exchange = await Exchange.findById(req.params.id)
        .populate('customerId')
        .populate('branchId')
        .populate('createdBy', 'name')
        .populate('invoiceId', 'invoiceNo grandTotal');

      if (!exchange) {
        throw ApiError.notFound('Exchange record not found');
      }
      assertBranchAccess(req, exchange);
      return ApiResponse.success(res, 'Exchange details', exchange);
    } catch (error) {
      next(error);
    }
  }

  static async adjust(req, res, next) {
    try {
      await guardBranch(req, Exchange, req.params.id, 'Exchange');
      const exchange = await ExchangeService.adjustToInvoice({
        exchangeId: req.params.id,
        invoiceId: req.body.invoiceId,
        amount: req.body.amount,
        userId: req.user._id
      });
      return ApiResponse.success(res, 'Old-gold value adjusted against invoice', exchange);
    } catch (error) {
      next(error);
    }
  }

  static async payout(req, res, next) {
    try {
      await guardBranch(req, Exchange, req.params.id, 'Exchange');
      const exchange = await ExchangeService.payout({
        exchangeId: req.params.id,
        amount: req.body.amount,
        paymentMode: req.body.paymentMode,
        modeDetails: req.body.modeDetails,
        userId: req.user._id
      });
      return ApiResponse.success(res, 'Old-gold value paid out to customer', exchange);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExchangeController;
