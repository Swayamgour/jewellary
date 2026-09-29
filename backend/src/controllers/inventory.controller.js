const escapeRegex = require('../utils/escapeRegex');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const DecimalUtil = require('../utils/decimal');
const InventoryService = require('../services/inventory.service');
const { logAudit } = require('../utils/auditLogger');
const { withTransaction } = require('../utils/transaction');
const { AUDIT_ACTIONS } = require('../config/constants');

class InventoryController {
  static async getInventory(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = { isDeleted: false };
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.status) query.status = req.query.status;
      if (req.query.metal) query.metal = req.query.metal;
      if (req.query.purity) query.purity = req.query.purity;
      if (req.query.categoryId) query.categoryId = req.query.categoryId;
      if (req.query.barcode) query.barcode = req.query.barcode.toUpperCase();

      if (req.query.search) {
        query.$or = [
          { barcode: { $regex: escapeRegex(req.query.search), $options: 'i' } },
          { warehouseLocation: { $regex: escapeRegex(req.query.search), $options: 'i' } }
        ];
      }

      const [inventory, total] = await Promise.all([
        Inventory.find(query)
          .populate('productId', 'name code sku')
          .populate('categoryId', 'name code')
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        Inventory.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Inventory fetched successfully', inventory, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getInventoryById(req, res, next) {
    try {
      const item = await Inventory.findById(req.params.id)
        .populate('productId')
        .populate('categoryId')
        .populate('branchId', 'name code');

      if (!item || item.isDeleted) {
        throw ApiError.notFound('Inventory item not found');
      }
      return ApiResponse.success(res, 'Inventory item details', item);
    } catch (error) {
      next(error);
    }
  }

  static async getStockMovements(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = {};
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.barcode) query.barcode = req.query.barcode.toUpperCase();
      if (req.query.movementType) query.movementType = req.query.movementType;

      const [movements, total] = await Promise.all([
        StockMovement.find(query)
          .populate('performedBy', 'name')
          .populate('productId', 'name code')
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        StockMovement.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Stock movement records fetched', movements, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async stockAdjustment(req, res, next) {
    try {
      const { barcode, adjustmentType, quantityDelta, reason } = req.body;
      const branchId = req.branchId || req.user.branchId;

      const result = await withTransaction(async (session) => {
        const item = await InventoryService.adjustStock({
          barcode,
          branchId,
          adjustmentType,
          quantityDelta,
          reason,
          performedBy: req.user._id,
          session
        });
        await logAudit(
          {
            userId: req.user._id,
            action: AUDIT_ACTIONS.STOCK_ADJUSTMENT,
            module: 'INVENTORY',
            recordId: item._id,
            newValue: { adjustmentType, quantityDelta, reason },
            branchId
          },
          session
        );
        return item;
      });

      return ApiResponse.success(res, 'Stock adjusted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async stockTransfer(req, res, next) {
    try {
      const { barcode, targetBranchId, reason } = req.body;
      const sourceBranchId = req.branchId || req.user.branchId;

      const result = await withTransaction(async (session) =>
        InventoryService.transferToBranch({
          barcode,
          sourceBranchId,
          targetBranchId,
          reason,
          performedBy: req.user._id,
          session
        })
      );

      return ApiResponse.success(res, 'Item transferred to target branch successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = InventoryController;
