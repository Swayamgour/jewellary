const Purchase = require('../models/Purchase');
const PurchaseService = require('../services/purchase.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

class PurchaseController {
  static async createPurchase(req, res, next) {
    try {
      const { vendorId, vendorInvoiceNo, purchaseDate, items, taxAmount, paidAmount, paymentMode, notes } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      const purchase = await PurchaseService.recordPurchase({
        vendorId,
        vendorInvoiceNo,
        branchId,
        purchaseDate,
        items,
        taxAmount,
        paidAmount,
        paymentMode,
        notes,
        userId: req.user._id
      });

      return ApiResponse.created(res, 'Purchase entry recorded and stock added', purchase);
    } catch (error) {
      next(error);
    }
  }

  static async getPurchases(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = {};
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.vendorId) query.vendorId = req.query.vendorId;
      if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;
      if (req.query.search) {
        query.$or = [
          { purchaseNo: { $regex: req.query.search, $options: 'i' } },
          { vendorInvoiceNo: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      const [purchases, total] = await Promise.all([
        Purchase.find(query).populate('vendorId', 'name company mobile').skip(skip).limit(limit).sort({ purchaseDate: -1 }),
        Purchase.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Purchases fetched successfully', purchases, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPurchaseById(req, res, next) {
    try {
      const purchase = await Purchase.findById(req.params.id)
        .populate('vendorId')
        .populate('branchId')
        .populate('createdBy', 'name');

      if (!purchase) {
        throw ApiError.notFound('Purchase record not found');
      }
      return ApiResponse.success(res, 'Purchase details', purchase);
    } catch (error) {
      next(error);
    }
  }

  static async recordPurchaseReturn(req, res, next) {
    try {
      const { items, reason } = req.body;
      const branchId = req.branchId || req.user.branchId;

      const purchaseReturn = await PurchaseService.recordPurchaseReturn({
        purchaseId: req.params.id,
        items,
        reason,
        branchId,
        userId: req.user._id
      });

      return ApiResponse.created(res, 'Purchase return recorded and stock deducted', purchaseReturn);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PurchaseController;
