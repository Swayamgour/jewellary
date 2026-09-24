const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const DecimalUtil = require('../utils/decimal');
const { logAudit } = require('../utils/auditLogger');
const { withTransaction } = require('../utils/transaction');
const { AUDIT_ACTIONS, STOCK_MOVEMENT_TYPES, INVENTORY_STATUSES } = require('../config/constants');

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
          { barcode: { $regex: req.query.search, $options: 'i' } },
          { warehouseLocation: { $regex: req.query.search, $options: 'i' } }
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
      const { barcode, adjustmentType, quantityDelta, weightDelta = 0, reason } = req.body;
      const branchId = req.branchId || req.user.branchId;

      const result = await withTransaction(async (session) => {
        const item = await Inventory.findOne({ barcode: barcode.toUpperCase(), branchId }).session(session);
        if (!item) {
          throw ApiError.notFound(`Item with barcode ${barcode} not found`);
        }

        const newQty = item.quantity + quantityDelta;
        if (newQty < 0) {
          throw ApiError.badRequest(`Adjustment would result in negative stock. Current: ${item.quantity}, Delta: ${quantityDelta}`);
        }

        item.quantity = newQty;
        if (item.quantity === 0) {
          item.status = adjustmentType === 'DAMAGE' ? INVENTORY_STATUSES.DAMAGED : INVENTORY_STATUSES.SOLD;
        } else {
          item.status = INVENTORY_STATUSES.AVAILABLE;
        }

        await item.save({ session });

        const movement = new StockMovement({
          inventoryId: item._id,
          barcode: item.barcode,
          productId: item.productId,
          movementType: adjustmentType,
          quantityDelta,
          weightDelta,
          balanceQuantity: item.quantity,
          balanceWeight: item.netWeight,
          branchId,
          referenceType: 'Manual',
          performedBy: req.user._id,
          reason
        });

        await movement.save({ session });

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

      if (sourceBranchId.toString() === targetBranchId.toString()) {
        throw ApiError.badRequest('Target branch cannot be the same as source branch');
      }

      const result = await withTransaction(async (session) => {
        const item = await Inventory.findOne({ barcode: barcode.toUpperCase(), branchId: sourceBranchId }).session(session);
        if (!item) {
          throw ApiError.notFound(`Item with barcode ${barcode} not found in this branch`);
        }

        if (item.status !== INVENTORY_STATUSES.AVAILABLE || item.quantity <= 0) {
          throw ApiError.badRequest(`Item ${barcode} is not available for transfer (Status: ${item.status})`);
        }

        // Transfer item branch
        item.branchId = targetBranchId;
        await item.save({ session });

        // Record transfer out
        const transferOut = new StockMovement({
          inventoryId: item._id,
          barcode: item.barcode,
          productId: item.productId,
          movementType: STOCK_MOVEMENT_TYPES.TRANSFER_OUT,
          quantityDelta: -item.quantity,
          weightDelta: -item.netWeight,
          balanceQuantity: 0,
          balanceWeight: 0,
          branchId: sourceBranchId,
          targetBranchId,
          referenceType: 'Transfer',
          performedBy: req.user._id,
          reason: `Transfer to Branch: ${reason || 'Inter-branch transfer'}`
        });

        // Record transfer in
        const transferIn = new StockMovement({
          inventoryId: item._id,
          barcode: item.barcode,
          productId: item.productId,
          movementType: STOCK_MOVEMENT_TYPES.TRANSFER_IN,
          quantityDelta: item.quantity,
          weightDelta: item.netWeight,
          balanceQuantity: item.quantity,
          balanceWeight: item.netWeight,
          branchId: targetBranchId,
          targetBranchId: sourceBranchId,
          referenceType: 'Transfer',
          performedBy: req.user._id,
          reason: `Transfer from Branch: ${reason || 'Inter-branch transfer'}`
        });

        await transferOut.save({ session });
        await transferIn.save({ session });

        return item;
      });

      return ApiResponse.success(res, 'Item transferred to target branch successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = InventoryController;
