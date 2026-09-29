const Purchase = require('../models/Purchase');
const PurchaseService = require('../services/purchase.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const PurchaseReturn = require('../models/PurchaseReturn');
const { assertBranchAccess, guardBranch } = require('../utils/branchScope');

class PurchaseController {
  static async createPurchase(req, res, next) {
    try {
      const { vendorId, vendorInvoiceNo, purchaseDate, items, taxAmount, paidAmount, paymentMode, modeDetails, status, notes } = req.body;
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
        modeDetails,
        status,
        notes,
        userId: req.user._id
      });

      return ApiResponse.created(res, status === 'DRAFT' ? 'Purchase saved as draft' : 'Purchase entry recorded and stock added', purchase);
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
      if (req.query.status) query.status = req.query.status;
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
      assertBranchAccess(req, purchase);
      return ApiResponse.success(res, 'Purchase details', purchase);
    } catch (error) {
      next(error);
    }
  }

  static async updatePurchase(req, res, next) {
    try {
      await guardBranch(req, Purchase, req.params.id, 'Purchase');
      const purchase = await PurchaseService.updateDraft({ purchaseId: req.params.id, ...req.body, userId: req.user._id });
      return ApiResponse.success(res, 'Draft purchase updated', purchase);
    } catch (error) {
      next(error);
    }
  }

  static async confirmPurchase(req, res, next) {
    try {
      await guardBranch(req, Purchase, req.params.id, 'Purchase');
      const purchase = await PurchaseService.confirmDraft({ purchaseId: req.params.id, ...req.body, userId: req.user._id });
      return ApiResponse.success(res, 'Purchase confirmed: stock added and vendor ledger posted', purchase);
    } catch (error) {
      next(error);
    }
  }

  static async cancelPurchase(req, res, next) {
    try {
      await guardBranch(req, Purchase, req.params.id, 'Purchase');
      const purchase = await PurchaseService.cancelPurchase({ purchaseId: req.params.id, ...req.body, userId: req.user._id });
      return ApiResponse.success(res, 'Purchase cancelled', purchase);
    } catch (error) {
      next(error);
    }
  }

  static async recordPayment(req, res, next) {
    try {
      await guardBranch(req, Purchase, req.params.id, 'Purchase');
      const result = await PurchaseService.recordPurchasePayment({
        purchaseId: req.params.id,
        ...req.body,
        branchId: req.branchId,
        userId: req.user._id
      });
      return ApiResponse.created(res, 'Payment recorded against purchase', result);
    } catch (error) {
      next(error);
    }
  }

  static async recordVendorRefund(req, res, next) {
    try {
      await guardBranch(req, Purchase, req.params.id, 'Purchase');
      const result = await PurchaseService.recordVendorRefund({
        purchaseId: req.params.id,
        ...req.body,
        branchId: req.branchId,
        userId: req.user._id
      });
      return ApiResponse.created(res, 'Vendor refund recorded', result);
    } catch (error) {
      next(error);
    }
  }

  static async recordPurchaseReturn(req, res, next) {
    try {
      await guardBranch(req, Purchase, req.params.id, 'Purchase');
      const { items, reason } = req.body;
      const purchaseReturn = await PurchaseService.recordPurchaseReturn({
        purchaseId: req.params.id,
        items,
        reason,
        userId: req.user._id
      });
      return ApiResponse.created(res, 'Purchase return recorded, stock deducted and purchase reconciled', purchaseReturn);
    } catch (error) {
      next(error);
    }
  }

  static async getPurchaseReturns(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const query = {};
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.purchaseId) query.purchaseId = req.query.purchaseId;
      if (req.query.vendorId) query.vendorId = req.query.vendorId;
      const [rows, total] = await Promise.all([
        PurchaseReturn.find(query).sort({ returnDate: -1 }).skip((page - 1) * limit).limit(limit),
        PurchaseReturn.countDocuments(query)
      ]);
      return ApiResponse.success(res, 'Purchase returns fetched', rows, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PurchaseController;
